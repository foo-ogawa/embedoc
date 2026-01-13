/**
 * code_snippet Embed
 * Extract and display code snippets from specified files or inline datasources
 *
 * Usage with file:
 *   <!--@embedoc:code_snippet file="path/to/file.ts" start="10" end="20" lang="typescript"-->
 *
 * Usage with inline datasource:
 *   <!--@embedoc:code_snippet datasource="my_code" lang="typescript"-->
 *
 * Parameters:
 *   - file: File path (relative to embedoc.config.yaml)
 *   - datasource: Name of inline datasource containing code (alternative to file)
 *   - path: Property path within datasource (optional, default: root)
 *   - start: Start line number (default: 1) - only for file mode
 *   - end: End line number (default: end of file) - only for file mode
 *   - lang: Language (default: auto-detect from extension)
 *   - title: Title (optional)
 */

import { defineEmbed, InlineDatasource } from '../../dist/index.js';
import fs from 'node:fs';
import path from 'node:path';

export default defineEmbed({
  async render(ctx) {
    const datasourceName = ctx.params['datasource'];
    const filePath = ctx.params['file'];
    const propertyPath = ctx.params['path'] || '';
    const lang = ctx.params['lang'] || (filePath ? detectLanguage(filePath) : '');
    const title = ctx.params['title'];

    // Mode 1: Inline datasource reference
    if (datasourceName) {
      const ds = ctx.datasources[datasourceName];
      if (!ds) {
        return { content: `⚠️ Datasource not found: ${datasourceName}` };
      }

      // Cast to InlineDatasource for type-safe access
      const inlineDs = ds as InlineDatasource;

      // Get code content from datasource
      let code: string;
      if (propertyPath) {
        const value = await inlineDs.get(propertyPath);
        if (value === undefined) {
          return { content: `⚠️ Property not found: ${propertyPath}` };
        }
        code = String(value);
      } else {
        // Get raw data for root
        const rawData = inlineDs.getRawData();
        if (typeof rawData === 'string') {
          code = rawData;
        } else {
          return { content: '⚠️ Datasource root is not a string. Use `path` parameter.' };
        }
      }

      // Get location metadata
      const meta = inlineDs.getMeta(propertyPath, ctx.filePath);

      // Generate output
      const parts: string[] = [];
      if (title) {
        parts.push(`**${title}**\n`);
      }
      parts.push(ctx.markdown.codeBlock(code, lang));

      // Add source reference with line numbers from metadata
      if (meta) {
        parts.push(`\n📄 Source: \`${meta.relativePath}\` (lines ${meta.contentStartLine}-${meta.contentEndLine})`);
      }

      return { content: parts.join('\n') };
    }

    // Mode 2: External file reference (original behavior)
    if (!filePath) {
      return { content: '⚠️ `file` or `datasource` parameter is required' };
    }

    const startLine = parseInt(ctx.params['start'] || '1', 10);
    const endLine = ctx.params['end'] ? parseInt(ctx.params['end'], 10) : undefined;

    // Resolve file path relative to project root (where embedoc.config.yaml is)
    const resolvedPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      return { content: `⚠️ File not found: ${filePath}` };
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const lines = content.split('\n');

    // Extract specified line range
    const start = Math.max(1, startLine) - 1; // Convert to 0-based index
    const end = endLine ? Math.min(endLine, lines.length) : lines.length;
    const snippet = lines.slice(start, end).join('\n');

    // Generate markdown code block
    const codeBlock = ctx.markdown.codeBlock(snippet, lang);

    // Build output with optional title
    const parts: string[] = [];

    if (title) {
      parts.push(`**${title}**\n`);
    }

    parts.push(codeBlock);

    // Add source reference
    const lineRange =
      endLine
        ? `${startLine}-${end}`
        : startLine > 1
          ? `${startLine}-${lines.length}`
          : 'full';
    parts.push(`\n📄 Source: \`${filePath}\` (lines ${lineRange})`);

    return { content: parts.join('\n') };
  },
});

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.json': 'json',
    '.md': 'markdown',
    '.sql': 'sql',
    '.sh': 'bash',
    '.bash': 'bash',
    '.hbs': 'handlebars',
    '.py': 'python',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.css': 'css',
    '.scss': 'scss',
    '.html': 'html',
    '.xml': 'xml',
  };
  return langMap[ext] || '';
}

