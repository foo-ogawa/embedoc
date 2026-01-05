/**
 * Markdown Helper
 * Utilities for generating Markdown strings
 */

import type { MarkdownHelper } from '../types/index.js';

/**
 * Escape cell content for Markdown tables
 */
function escapeCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);
  // Escape pipe characters and newlines
  return str.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

/**
 * Create a Markdown helper instance
 */
export function createMarkdownHelper(): MarkdownHelper {
  return {
    /**
     * Generate a table
     */
    table(
      headers: string[],
      rows: (string | number | boolean | null | undefined)[][]
    ): string {
      if (headers.length === 0) {
        return '';
      }

      const lines: string[] = [];

      // Header row
      const headerLine = '| ' + headers.map(escapeCell).join(' | ') + ' |';
      lines.push(headerLine);

      // Separator row
      const separatorLine = '| ' + headers.map(() => '---').join(' | ') + ' |';
      lines.push(separatorLine);

      // Data rows
      for (const row of rows) {
        const cells = headers.map((_, i) => escapeCell(row[i]));
        const rowLine = '| ' + cells.join(' | ') + ' |';
        lines.push(rowLine);
      }

      return lines.join('\n');
    },

    /**
     * Generate a list
     */
    list(items: string[], ordered = false): string {
      return items
        .map((item, index) => {
          const prefix = ordered ? `${index + 1}.` : '-';
          return `${prefix} ${item}`;
        })
        .join('\n');
    },

    /**
     * Generate a code block
     */
    codeBlock(code: string, language = ''): string {
      return '```' + language + '\n' + code + '\n```';
    },

    /**
     * Generate a link
     */
    link(text: string, url: string): string {
      return `[${text}](${url})`;
    },

    /**
     * Generate a heading
     */
    heading(text: string, level = 1): string {
      const prefix = '#'.repeat(Math.min(Math.max(level, 1), 6));
      return `${prefix} ${text}`;
    },

    /**
     * Generate bold text
     */
    bold(text: string): string {
      return `**${text}**`;
    },

    /**
     * Generate italic text
     */
    italic(text: string): string {
      return `*${text}*`;
    },

    /**
     * Generate a checkbox
     */
    checkbox(checked: boolean): string {
      return checked ? '✔' : '';
    },
  };
}
