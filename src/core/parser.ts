/**
 * Marker Parser
 * Detects blocks enclosed by comment-style markers
 */

import type { CommentStyle, ParsedMarker, ParsedFrontmatter } from '../types/index.js';
import type { ParsedInlineData } from './inline-datasource.js';
import matter from 'gray-matter';

/**
 * Default comment style definitions
 */
export const DEFAULT_COMMENT_STYLES: Record<string, CommentStyle> = {
  html: { start: '<!--', end: '-->' },
  block: { start: '/*', end: '*/' },
  line: { start: '//', end: '' },
  hash: { start: '#', end: '' },
  sql: { start: '--', end: '' },
};

/**
 * Parse attribute string into object
 * Example: 'id="users" schema="public"' -> { id: 'users', schema: 'public' }
 */
export function parseAttributes(attrString: string): Record<string, string> {
  const result: Record<string, string> = {};
  // Match key="value" or key='value' patterns
  const attrRegex = /(\w+)=["']([^"']*)["']/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(attrString)) !== null) {
    const key = match[1];
    const value = match[2];
    if (key && value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Resolve variable references in attribute values
 * Example: ${doc_id} -> frontmatter.doc_id value
 */
export function resolveVariables(
  params: Record<string, string>,
  frontmatter: Record<string, unknown>
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    result[key] = value.replace(/\$\{(\w+(?:\.\w+)*)\}/g, (_, path: string) => {
      const parts = path.split('.');
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
 * Parse frontmatter from content
 */
export function parseFrontmatter(content: string): ParsedFrontmatter {
  const parsed = matter(content);

  // Reconstruct frontmatter part (remove extra newlines)
  let raw = '';
  if (Object.keys(parsed.data).length > 0 && parsed.matter) {
    // Trim extra newlines from matter
    const cleanMatter = parsed.matter.trim();
    raw = `---\n${cleanMatter}\n---\n`;
  }

  // Remove leading newlines from content
  const cleanContent = parsed.content.replace(/^\n+/, '');

  return {
    data: parsed.data as Record<string, unknown>,
    content: cleanContent,
    raw,
  };
}

/**
 * Parse all markers in a file
 */
export function parseMarkers(
  content: string,
  commentStyle: CommentStyle
): ParsedMarker[] {
  const markers: ParsedMarker[] = [];
  const { start, end } = commentStyle;

  const startEscaped = escapeRegExp(start);
  const endEscaped = end ? escapeRegExp(end) : '';

  // Start marker pattern
  // {start}@embedoc:{template_name} {attributes}{end}
  // For line comment style (empty end), match until newline
  // Note: "end" is reserved for end marker, so exclude it (using negative lookahead)
  let startPattern: RegExp;
  if (end) {
    // Block comment style
    startPattern = new RegExp(
      `${startEscaped}\\s*@embedoc:(?!end\\b)(\\w+)\\s*([^]*?)\\s*${endEscaped}`,
      'g'
    );
  } else {
    // Line comment style
    startPattern = new RegExp(
      `${startEscaped}\\s*@embedoc:(?!end\\b)(\\w+)\\s*(.*)$`,
      'gm'
    );
  }

  // End marker pattern
  let endPattern: RegExp;
  if (end) {
    endPattern = new RegExp(`${startEscaped}\\s*@embedoc:end\\s*${endEscaped}`);
  } else {
    endPattern = new RegExp(`${startEscaped}\\s*@embedoc:end\\s*$`, 'm');
  }

  let match: RegExpExecArray | null;

  while ((match = startPattern.exec(content)) !== null) {
    const startIndex = match.index;
    const startMarkerLine = match[0];
    const templateName = match[1];
    const attrString = match[2]?.trim() ?? '';

    // Search for end marker from after start marker
    const afterStart = startIndex + startMarkerLine.length;
    const remainingContent = content.slice(afterStart);
    const endMatch = endPattern.exec(remainingContent);

    if (endMatch) {
      const endMarkerLine = endMatch[0];
      const endIndex = afterStart + endMatch.index + endMarkerLine.length;
      const existingContent = remainingContent.slice(0, endMatch.index);

      if (templateName) {
        markers.push({
          startIndex,
          endIndex,
          templateName,
          params: parseAttributes(attrString),
          existingContent,
          startMarkerLine,
          endMarkerLine,
        });
      }
    }
  }

  return markers;
}

/**
 * Get CommentStyle object from style name
 */
export function getCommentStyle(
  styleName: string,
  customStyles?: Record<string, CommentStyle>
): CommentStyle {
  const styles = { ...DEFAULT_COMMENT_STYLES, ...customStyles };
  const style = styles[styleName];

  if (!style) {
    throw new Error(`Unknown comment style: ${styleName}`);
  }

  return style;
}

/**
 * Guess default comment style from file extension
 */
export function guessCommentStyle(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';

  const extToStyle: Record<string, string> = {
    md: 'html',
    html: 'html',
    xml: 'html',
    htm: 'html',
    js: 'block',
    ts: 'block',
    jsx: 'block',
    tsx: 'block',
    css: 'block',
    java: 'block',
    c: 'block',
    cpp: 'block',
    h: 'block',
    hpp: 'block',
    go: 'line',
    py: 'hash',
    rb: 'hash',
    sh: 'hash',
    bash: 'hash',
    yaml: 'hash',
    yml: 'hash',
    sql: 'sql',
  };

  return extToStyle[ext] ?? 'html';
}

/**
 * Calculate line number from content index
 */
function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

/**
 * Parse inline data markers (@embedoc-data)
 */
export function parseInlineDataMarkers(
  content: string,
  commentStyle: CommentStyle
): ParsedInlineData[] {
  const results: ParsedInlineData[] = [];
  const { start, end } = commentStyle;

  const startEscaped = escapeRegExp(start);
  const endEscaped = end ? escapeRegExp(end) : '';

  // Pattern for @embedoc-data:name markers (excluding 'end')
  // Supports: @embedoc-data:name or @embedoc-data:name format="yaml"
  let startPattern: RegExp;
  let endPattern: RegExp;

  if (end) {
    // Block comment style - capture attributes without newlines
    // Use negative lookahead to exclude 'end' as a name
    startPattern = new RegExp(
      `${startEscaped}\\s*@embedoc-data:(?!end\\s*${endEscaped})([\\w.]+)(?:\\s+([^\\n]*?))?\\s*${endEscaped}`,
      'g'
    );
    endPattern = new RegExp(`${startEscaped}\\s*@embedoc-data:end\\s*${endEscaped}`);
  } else {
    // Line comment style - exclude 'end' as a name
    startPattern = new RegExp(
      `${startEscaped}\\s*@embedoc-data:(?!end\\s*$)([\\w.]+)(?:\\s+(.*))?$`,
      'gm'
    );
    endPattern = new RegExp(`${startEscaped}\\s*@embedoc-data:end\\s*$`, 'm');
  }

  let match: RegExpExecArray | null;

  while ((match = startPattern.exec(content)) !== null) {
    const startIndex = match.index;
    const startMarkerLine = match[0];
    const name = match[1];
    const attrString = match[2]?.trim() ?? '';

    // Skip if name is 'end' (shouldn't happen with negative lookahead, but be safe)
    if (!name || name === 'end') {
      continue;
    }

    // Parse format attribute
    const attrs = parseAttributes(attrString);
    const format = (attrs['format'] ?? 'yaml') as ParsedInlineData['format'];

    // Find end marker - search from after start marker
    const afterStart = startIndex + startMarkerLine.length;
    const remainingContent = content.slice(afterStart);
    
    // Reset lastIndex for endPattern search
    endPattern.lastIndex = 0;
    const endMatch = endPattern.exec(remainingContent);

    if (endMatch) {
      const dataContent = remainingContent.slice(0, endMatch.index);
      const startLine = getLineNumber(content, startIndex);
      const endLine = getLineNumber(content, afterStart + endMatch.index + endMatch[0].length);

      results.push({
        name,
        format,
        content: dataContent,
        startLine,
        endLine,
        byteSize: Buffer.byteLength(dataContent, 'utf-8'),
      });
    }
  }

  return results;
}

/**
 * Escape special regex characters
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
