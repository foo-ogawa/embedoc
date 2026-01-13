/**
 * Replacement Processor
 * Replace marker-enclosed blocks with embed execution results
 */

import { readFile, writeFile } from 'node:fs/promises';
import { glob } from 'glob';
import type {
  EmbedifyConfig,
  EmbedDefinition,
  EmbedContext,
  Datasource,
  ProcessResult,
  BuildResult,
  TargetConfig,
} from '../types/index.js';
import {
  parseMarkers,
  parseFrontmatter,
  getCommentStyle,
  parseInlineDataMarkers,
} from './parser.js';
import { createMarkdownHelper } from '../helpers/markdown.js';
import { buildInlineDatasources, resolveDotPath, InlineDatasource } from './inline-datasource.js';

/**
 * Resolve variables with support for inline datasources
 * Supports ${frontmatter.key}, ${datasourceName.path.to.value}
 */
function resolveVariablesWithInline(
  params: Record<string, string>,
  frontmatter: Record<string, unknown>,
  inlineDatasources: Map<string, InlineDatasource>
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    result[key] = value.replace(/\$\{(\w+(?:\.\w+|\[\d+\])*)\}/g, (_, path: string) => {
      const parts = path.split('.');
      const rootName = parts[0];
      if (!rootName) return '';
      
      // Check inline datasources first
      const inlineDs = inlineDatasources.get(rootName);
      if (inlineDs) {
        const subPath = parts.slice(1).join('.');
        if (subPath) {
          const resolved = resolveDotPath(inlineDs.data, subPath);
          return resolved !== null && resolved !== undefined ? String(resolved) : '';
        }
        // If no subpath, return stringified value
        const data = inlineDs.data;
        return data !== null && data !== undefined ? String(data) : '';
      }

      // Fall back to frontmatter
      let current: unknown = frontmatter;
      for (const part of parts) {
        if (current === null || current === undefined) {
          return '';
        }
        if (typeof current === 'object') {
          current = (current as Record<string, unknown>)[part];
        } else {
          return '';
        }
      }

      return current !== null && current !== undefined ? String(current) : '';
    });
  }

  return result;
}

/**
 * Process a single file
 */
export async function processFile(
  filePath: string,
  content: string,
  targetConfig: TargetConfig,
  embeds: Record<string, EmbedDefinition>,
  datasources: Record<string, Datasource>,
  config: EmbedifyConfig,
  dryRun = false
): Promise<ProcessResult> {
  const result: ProcessResult = {
    filePath,
    success: true,
    markersUpdated: 0,
    changed: false,
  };

  try {
    // Get comment style
    const commentStyle = getCommentStyle(
      targetConfig.comment_style,
      config.comment_styles
    );

    // Parse frontmatter
    const { data: frontmatter, content: bodyContent, raw: frontmatterRaw } =
      parseFrontmatter(content);

    // Calculate frontmatter line offset for accurate line numbers
    const frontmatterLineOffset = frontmatterRaw ? frontmatterRaw.split('\n').length - 1 : 0;

    // Parse inline data markers
    const inlineDataMarkers = parseInlineDataMarkers(bodyContent, commentStyle);
    
    // Adjust line numbers for frontmatter offset
    for (const marker of inlineDataMarkers) {
      marker.startLine += frontmatterLineOffset;
      marker.endLine += frontmatterLineOffset;
    }
    
    // Build inline datasources
    const inlineDatasources = buildInlineDatasources(
      inlineDataMarkers,
      filePath,
      config.inline_datasource
    );

    // Merge inline datasources with external (inline takes precedence)
    const mergedDatasources: Record<string, Datasource> = { ...datasources };
    for (const [name, ds] of inlineDatasources) {
      if (name in mergedDatasources) {
        const policy = config.inline_datasource?.conflictPolicy ?? 'warn';
        if (policy === 'error') {
          throw new Error(
            `Inline datasource "${name}" conflicts with external datasource (conflict_policy: error)`
          );
        } else if (policy === 'prefer_external') {
          continue; // Skip inline, use external
        } else {
          console.warn(
            `Warning: Inline datasource "${name}" overrides external datasource in ${filePath}`
          );
        }
      }
      mergedDatasources[name] = ds;
    }

    // Parse markers
    const markers = parseMarkers(bodyContent, commentStyle);

    if (markers.length === 0 && inlineDataMarkers.length === 0) {
      return result;
    }

    // Create helpers
    const markdownHelper = createMarkdownHelper();

    // Replace from end to start (to preserve indices)
    let processedContent = bodyContent;
    const sortedMarkers = [...markers].sort((a, b) => b.startIndex - a.startIndex);

    for (const marker of sortedMarkers) {
      // Get embed
      const embed = embeds[marker.templateName];

      if (!embed) {
        console.warn(`Warning: Unknown embed "${marker.templateName}" in ${filePath}`);
        continue;
      }

      // Resolve parameter variables (including inline datasources)
      const resolvedParams = resolveVariablesWithInline(
        marker.params,
        frontmatter,
        inlineDatasources
      );

      // Create context
      const ctx: EmbedContext = {
        params: resolvedParams,
        frontmatter,
        datasources: mergedDatasources,
        markdown: markdownHelper,
        filePath,
      };

      // Execute embed
      const embedResult = await embed.render(ctx);

      // Check for inline mode (no newlines around content)
      const isInline = marker.params['inline'] === 'true';

      // Replace content
      const newContent = isInline
        ? marker.startMarkerLine + embedResult.content + marker.endMarkerLine
        : marker.startMarkerLine +
          '\n' +
          embedResult.content +
          '\n' +
          marker.endMarkerLine;

      processedContent =
        processedContent.slice(0, marker.startIndex) +
        newContent +
        processedContent.slice(marker.endIndex);

      result.markersUpdated++;
    }

    // Prepend frontmatter
    const finalContent = frontmatterRaw + processedContent;

    // Check if changed
    if (finalContent !== content) {
      result.changed = true;

      if (!dryRun) {
        // Write to file
        const lineEnding = config.output?.line_ending ?? 'lf';
        const outputContent =
          lineEnding === 'crlf'
            ? finalContent.replace(/\n/g, '\r\n')
            : finalContent;

        await writeFile(filePath, outputContent, {
          encoding: config.output?.encoding ?? 'utf-8',
        });
      }
    }

    // Cleanup inline datasources
    for (const ds of inlineDatasources.values()) {
      await ds.close();
    }
  } catch (error) {
    result.success = false;
    result.error = error instanceof Error ? error : new Error(String(error));
  }

  return result;
}

/**
 * Get target files
 */
async function getTargetFiles(
  targetConfig: TargetConfig
): Promise<string[]> {
  const files = await glob(targetConfig.pattern, {
    ignore: targetConfig.exclude ?? [],
    nodir: true,
  });

  return files;
}

/**
 * Process all target files
 */
export async function build(
  config: EmbedifyConfig,
  embeds: Record<string, EmbedDefinition>,
  datasources: Record<string, Datasource>,
  options: {
    dryRun?: boolean;
    verbose?: boolean;
    specificFiles?: string[];
  } = {}
): Promise<BuildResult> {
  const startTime = Date.now();
  const results: ProcessResult[] = [];

  for (const targetConfig of config.targets) {
    // Get target files
    let files: string[];

    if (options.specificFiles && options.specificFiles.length > 0) {
      // When specific files are provided
      files = options.specificFiles.filter((f) =>
        f.endsWith(targetConfig.pattern.split('*').pop() ?? '')
      );
    } else {
      files = await getTargetFiles(targetConfig);
    }

    // Process each file
    for (const filePath of files) {
      if (options.verbose) {
        console.log(`Processing: ${filePath}`);
      }

      try {
        const content = await readFile(filePath, { encoding: 'utf-8' });
        const result = await processFile(
          filePath,
          content,
          targetConfig,
          embeds,
          datasources,
          config,
          options.dryRun
        );

        results.push(result);

        if (options.verbose && result.markersUpdated > 0) {
          console.log(
            `  Updated ${result.markersUpdated} marker(s)${result.changed ? ' (changed)' : ' (no changes)'}`
          );
        }
      } catch (error) {
        results.push({
          filePath,
          success: false,
          markersUpdated: 0,
          changed: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });

        if (options.verbose) {
          console.error(`  Error: ${error}`);
        }
      }
    }
  }

  const duration = Date.now() - startTime;

  return {
    totalFiles: results.length,
    successFiles: results.filter((r) => r.success).length,
    failedFiles: results.filter((r) => !r.success).length,
    totalMarkersUpdated: results.reduce((sum, r) => sum + r.markersUpdated, 0),
    results,
    duration,
  };
}
