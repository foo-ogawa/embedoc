/**
 * code_snippet Embed
 * Extract and display code snippets from specified files
 *
 * Usage: <!--@embedoc:code_snippet file="path/to/file.ts" start="10" end="20" lang="typescript"-->
 *
 * Parameters:
 *   - file: File path (relative to embedoc.config.yaml)
 *   - start: Start line number (default: 1)
 *   - end: End line number (default: end of file)
 *   - lang: Language (default: auto-detect from extension)
 *   - title: Title (optional)
 */

import { defineEmbed } from 'embedoc';
import fs from 'node:fs';
import path from 'node:path';

export default defineEmbed({
  async render(ctx) {
    const filePath = ctx.params['file'];
    const startLine = parseInt(ctx.params['start'] || '1', 10);
    const endLine = ctx.params['end'] ? parseInt(ctx.params['end'], 10) : undefined;
    const lang = ctx.params['lang'] || detectLanguage(filePath);
    const title = ctx.params['title'];

    if (!filePath) {
      return { content: '⚠️ `file` parameter is required' };
    }

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

