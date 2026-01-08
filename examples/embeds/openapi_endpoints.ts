/**
 * openapi_endpoints Embed
 * Parse OpenAPI YAML file and display endpoints as a table
 *
 * Usage: <!--@embedoc:openapi_endpoints file="openapi.yaml"-->
 *
 * Parameters:
 *   - file: Path to OpenAPI YAML file (relative to project root)
 *   - tag: Filter by tag (optional)
 */

import { defineEmbed } from 'embedoc';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: Record<
    string,
    Record<
      string,
      {
        summary?: string;
        description?: string;
        tags?: string[];
        operationId?: string;
        security?: Array<Record<string, string[]>>;
      }
    >
  >;
}

export default defineEmbed({
  async render(ctx) {
    const filePath = ctx.params['file'];
    const tagFilter = ctx.params['tag'];

    if (!filePath) {
      return { content: '⚠️ `file` parameter is required' };
    }

    // Resolve file path relative to project root
    const resolvedPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      return { content: `⚠️ File not found: ${filePath}` };
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    let spec: OpenAPISpec;

    try {
      spec = yaml.load(content) as OpenAPISpec;
    } catch (e) {
      return { content: `⚠️ Failed to parse OpenAPI file: ${e}` };
    }

    if (!spec.paths) {
      return { content: '⚠️ No paths found in OpenAPI spec' };
    }

    // Extract endpoints
    const endpoints: Array<{
      path: string;
      method: string;
      summary: string;
      tags: string[];
      auth: boolean;
    }> = [];

    for (const [pathStr, pathItem] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method)) {
          const tags = operation.tags || [];
          
          // Apply tag filter if specified
          if (tagFilter && !tags.includes(tagFilter)) {
            continue;
          }

          endpoints.push({
            path: pathStr,
            method: method.toUpperCase(),
            summary: operation.summary || operation.description || '',
            tags,
            auth: !!operation.security && operation.security.length > 0,
          });
        }
      }
    }

    if (endpoints.length === 0) {
      return { content: '⚠️ No endpoints found' + (tagFilter ? ` with tag "${tagFilter}"` : '') };
    }

    // Sort by path then method
    endpoints.sort((a, b) => {
      const pathCompare = a.path.localeCompare(b.path);
      if (pathCompare !== 0) return pathCompare;
      return a.method.localeCompare(b.method);
    });

    // Generate Markdown table
    const markdown = ctx.markdown.table(
      ['Method', 'Endpoint', 'Description', 'Tags', 'Auth'],
      endpoints.map((ep) => [
        ctx.markdown.bold(ep.method),
        `\`${ep.path}\``,
        ep.summary,
        ep.tags.length > 0 ? ep.tags.map(t => `\`${t}\``).join(', ') : '',
        ep.auth ? '✔' : '',
      ])
    );

    // Add header with API info
    const header = `**${spec.info.title}** v${spec.info.version} (${endpoints.length} endpoints)\n\n`;

    return { content: header + markdown };
  },
});

