/**
 * File Generator
 * Generate new files from datasource records using Handlebars templates
 */

import { readFile, writeFile, mkdir, access, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import Handlebars from 'handlebars';
import type {
  EmbedocConfig,
  DatasourceConfig,
  GeneratorConfig,
  GenerateResult,
  Datasource,
} from '../types/index.js';
import { glob } from 'glob';
import { renderApiPage } from '../helpers/api-markdown.js';

/**
 * Register built-in Handlebars helpers
 */
function registerHelpers(): void {
  // today: Current date (YYYY-MM-DD)
  Handlebars.registerHelper('today', () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });

  // datetime: Current datetime
  Handlebars.registerHelper('datetime', () => {
    return new Date().toISOString();
  });

  // eq: Equal comparison
  Handlebars.registerHelper('eq', (a, b) => a === b);

  // ne: Not equal comparison
  Handlebars.registerHelper('ne', (a, b) => a !== b);

  // gt: Greater than
  Handlebars.registerHelper('gt', (a, b) => a > b);

  // lt: Less than
  Handlebars.registerHelper('lt', (a, b) => a < b);

  // and: Logical AND
  Handlebars.registerHelper('and', (...args) => {
    args.pop(); // Remove options
    return args.every(Boolean);
  });

  // or: Logical OR
  Handlebars.registerHelper('or', (...args) => {
    args.pop(); // Remove options
    return args.some(Boolean);
  });

  // json: JSON stringify
  Handlebars.registerHelper('json', (obj) => {
    return JSON.stringify(obj, null, 2);
  });

  // uppercase: Convert to uppercase
  Handlebars.registerHelper('uppercase', (str) => {
    return String(str ?? '').toUpperCase();
  });

  // lowercase: Convert to lowercase
  Handlebars.registerHelper('lowercase', (str) => {
    return String(str ?? '').toLowerCase();
  });

  // capitalize: Capitalize first letter
  Handlebars.registerHelper('capitalize', (str) => {
    const s = String(str ?? '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  });

  // replace: String replacement
  Handlebars.registerHelper('replace', (str, search, replacement) => {
    return String(str ?? '').replace(new RegExp(search, 'g'), replacement);
  });

  // api_page: Page of one record of a `typescript` datasource
  // {{api_page this index_file="README.md"}}
  Handlebars.registerHelper('api_page', (record: Record<string, unknown>, options: Handlebars.HelperOptions) => {
    const indexFile = (options.hash as Record<string, unknown>)['index_file'];
    return new Handlebars.SafeString(
      renderApiPage(record, { indexFile: typeof indexFile === 'string' ? indexFile : undefined })
    );
  });
}

// Register helpers
registerHelpers();

/**
 * Compile and render template
 */
async function renderTemplate(
  templatePath: string,
  data: Record<string, unknown>
): Promise<string> {
  const templateContent = await readFile(templatePath, { encoding: 'utf-8' });
  const template = Handlebars.compile(templateContent);
  return template(data);
}

/**
 * Replace output path placeholders
 * {column_name} -> record.column_name
 * Also supports column names with special characters (#, -, ., etc.)
 */
function resolveOutputPath(
  pathTemplate: string,
  record: Record<string, unknown>
): string {
  return pathTemplate.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = record[key];
    return value !== null && value !== undefined ? String(value) : '';
  });
}

/**
 * Check if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate file from a single record
 */
async function generateFile(
  record: Record<string, unknown>,
  generatorConfig: GeneratorConfig,
  templatesDir: string,
  config: EmbedocConfig,
  dryRun = false
): Promise<GenerateResult> {
  // Resolve output path
  const outputPath = resolveOutputPath(generatorConfig.output_path, record);

  const result: GenerateResult = {
    filePath: outputPath,
    success: true,
    skipped: false,
  };

  try {
    // Check existing file
    const exists = await fileExists(outputPath);

    if (exists && !generatorConfig.overwrite) {
      result.skipped = true;
      return result;
    }

    // Resolve template path
    const templatePath = join(templatesDir, generatorConfig.template);

    // Render template
    const content = await renderTemplate(templatePath, record);

    if (!dryRun) {
      // Create directory
      await mkdir(dirname(outputPath), { recursive: true });

      // Write file
      const lineEnding = config.output?.line_ending ?? 'lf';
      const outputContent =
        lineEnding === 'crlf' ? content.replace(/\n/g, '\r\n') : content;

      await writeFile(outputPath, outputContent, {
        encoding: config.output?.encoding ?? 'utf-8',
      });
    }
  } catch (error) {
    result.success = false;
    result.error = error instanceof Error ? error : new Error(String(error));
  }

  return result;
}

/**
 * Records selected by a generator's `where`
 */
function selectRecords(
  records: Record<string, unknown>[],
  where: GeneratorConfig['where']
): Record<string, unknown>[] {
  if (where === undefined) {
    return records;
  }
  const conditions = Object.entries(where).map(([field, value]) => {
    const values = Array.isArray(value) ? value : [value];
    if (!values.every((v) => typeof v === 'string')) {
      throw new Error(`Generator "where.${field}" must be a string or a list of strings`);
    }
    return { field, values: new Set(values) };
  });
  return records.filter((record) =>
    conditions.every(({ field, values }) => values.has(String(record[field])))
  );
}

/**
 * Delete the files that match a generator's output_path (placeholders read
 * as `*`) and are not among the files it is responsible for in this run.
 */
async function pruneOutputs(
  outputPath: string,
  keep: Set<string>,
  dryRun: boolean
): Promise<GenerateResult[]> {
  const pattern = outputPath.replace(/\{[^}]+\}/g, '*');
  const results: GenerateResult[] = [];
  for (const file of (await glob(pattern, { nodir: true })).sort()) {
    if (keep.has(resolve(file))) continue;
    const result: GenerateResult = { filePath: file, success: true, skipped: false, removed: true };
    try {
      if (!dryRun) await unlink(file);
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error : new Error(String(error));
    }
    results.push(result);
  }
  return results;
}

/**
 * Generate files from datasource
 */
export async function generateFromDatasource(
  datasourceName: string,
  datasourceConfig: DatasourceConfig,
  datasource: Datasource,
  config: EmbedocConfig,
  options: {
    dryRun?: boolean;
    verbose?: boolean;
    generatorName?: string;
  } = {}
): Promise<GenerateResult[]> {
  const results: GenerateResult[] = [];

  if (!datasourceConfig.generators || datasourceConfig.generators.length === 0) {
    if (options.verbose) {
      console.log(`No generators defined for datasource: ${datasourceName}`);
    }
    return results;
  }

  // Templates directory
  const templatesDir = config.templates_dir ?? '.embedoc/templates';

  // Get data
  const records = await datasource.getAll();

  if (options.verbose) {
    console.log(`Found ${records.length} records in datasource: ${datasourceName}`);
  }

  // Process each generator
  for (const generatorConfig of datasourceConfig.generators) {
    // Filter by specific generator if provided
    if (options.generatorName && generatorConfig.template !== options.generatorName) {
      continue;
    }

    if (options.verbose) {
      console.log(`  Generator: ${generatorConfig.template}`);
    }

    // Generate file for each selected record
    const written = new Set<string>();
    for (const record of selectRecords(records, generatorConfig.where)) {
      const result = await generateFile(
        record,
        generatorConfig,
        templatesDir,
        config,
        options.dryRun
      );

      results.push(result);
      written.add(resolve(result.filePath));

      if (options.verbose) {
        if (result.skipped) {
          console.log(`    Skipped (exists): ${result.filePath}`);
        } else if (result.success) {
          console.log(`    Generated: ${result.filePath}`);
        } else {
          console.log(`    Failed: ${result.filePath} - ${result.error?.message}`);
        }
      }
    }

    if (generatorConfig.prune) {
      const removed = await pruneOutputs(generatorConfig.output_path, written, options.dryRun ?? false);
      results.push(...removed);
      if (options.verbose) {
        for (const r of removed) console.log(`    Removed: ${r.filePath}`);
      }
    }
  }

  return results;
}

/**
 * Generate files from all datasources
 */
export async function generateAll(
  config: EmbedocConfig,
  datasources: Record<string, Datasource>,
  options: {
    dryRun?: boolean;
    verbose?: boolean;
    datasourceName?: string;
    generatorName?: string;
  } = {}
): Promise<GenerateResult[]> {
  const results: GenerateResult[] = [];

  if (!config.datasources) {
    return results;
  }

  for (const [name, dsConfig] of Object.entries(config.datasources)) {
    // Filter by specific datasource if provided
    if (options.datasourceName && name !== options.datasourceName) {
      continue;
    }

    // Skip if no generators
    if (!dsConfig.generators || dsConfig.generators.length === 0) {
      continue;
    }

    const datasource = datasources[name];
    if (!datasource) {
      if (options.verbose) {
        console.warn(`Datasource not initialized: ${name}`);
      }
      continue;
    }

    if (options.verbose) {
      console.log(`\nProcessing datasource: ${name}`);
    }

    const dsResults = await generateFromDatasource(
      name,
      dsConfig,
      datasource,
      config,
      options
    );

    results.push(...dsResults);
  }

  return results;
}
