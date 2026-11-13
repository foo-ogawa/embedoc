/**
 * Marker Parser
 * Detects blocks enclosed by comment-style markers
 */

import type { CommentStyle, ParsedMarker, ParsedFrontmatter } from '../types/index.js';
import type { ParsedInlineData } from './inline-datasource.js';
import yaml from 'js-yaml';

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
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return {
      data: {},
      content,
      raw: '',
    };
  }

  const matterBody = match[1] ?? '';
  const parsed = yaml.load(matterBody);
  const data = (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
    ? parsed as Record<string, unknown>
    : {};

  const cleanContent = content.slice(match[0].length).replace(/^\n+/, '');
  const raw = `---\n${matterBody.trim()}\n---\n`;

  return {
    data,
    content: cleanContent,
    raw,
  };
}

/**
 * Options for {@link parseMarkers} and {@link parseInlineDataMarkers}.
 */
export interface MarkerParseOptions {
  /**
   * The content is Markdown: markers inside fenced code blocks are example
   * code, not markers, and are skipped (see {@link isMarkdownFile}).
   */
  markdown?: boolean;
}

/**
 * Whether a target file is Markdown, by extension (.md, .markdown, .mdx).
 */
export function isMarkdownFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return ext === 'md' || ext === 'markdown' || ext === 'mdx';
}

/**
 * Index ranges `[start, end)` of the fenced code blocks of Markdown content.
 *
 * A fence is a line of three or more backticks or tildes, indented at most
 * three spaces. It is closed by a line of the same character, at least as long,
 * with nothing else on it. A fence that is never closed runs to the end.
 */
export function codeFenceRanges(content: string): [number, number][] {
  const ranges: [number, number][] = [];
  let open: { char: string; length: number; start: number } | null = null;
  let offset = 0;
  for (const line of content.split('\n')) {
    const next = offset + line.length + 1;
    const fence = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line.replace(/\r$/, ''));
    if (fence) {
      const run = fence[1]!;
      if (open === null) {
        // A backtick fence's info string cannot contain a backtick.
        if (!(run[0] === '`' && fence[2]!.includes('`'))) {
          open = { char: run[0]!, length: run.length, start: offset };
        }
      } else if (run[0] === open.char && run.length >= open.length && fence[2]!.trim() === '') {
        ranges.push([open.start, Math.min(next, content.length)]);
        open = null;
      }
    }
    offset = next;
  }
  if (open !== null) ranges.push([open.start, content.length]);
  return ranges;
}

/**
 * Test for "index is inside one of the ranges" (ranges from {@link codeFenceRanges}).
 */
function insideRanges(ranges: [number, number][]): (index: number) => boolean {
  return (index) => ranges.some(([from, to]) => index >= from && index < to);
}

/**
 * First match of a pattern at or after `from` that `skip` does not reject.
 * Returns the match with `index` relative to `content`.
 */
function findOutside(
  pattern: RegExp,
  content: string,
  from: number,
  skip: (index: number) => boolean
): RegExpExecArray | null {
  const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  global.lastIndex = from;
  let match: RegExpExecArray | null;
  while ((match = global.exec(content)) !== null) {
    if (!skip(match.index)) return match;
    if (match[0].length === 0) global.lastIndex++;
  }
  return null;
}

/**
 * Parse all markers in a file
 */
export function parseMarkers(
  content: string,
  commentStyle: CommentStyle,
  options: MarkerParseOptions = {}
): ParsedMarker[] {
  const markers: ParsedMarker[] = [];
  const { start, end } = commentStyle;
  const inFence = insideRanges(options.markdown ? codeFenceRanges(content) : []);

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
    if (inFence(startIndex)) {
      continue;
    }
    const startMarkerLine = match[0];
    const templateName = match[1];
    const attrString = match[2]?.trim() ?? '';

    // Search for end marker from after start marker
    const afterStart = startIndex + startMarkerLine.length;
    const remainingContent = content.slice(afterStart);
    const endFound = findOutside(endPattern, content, afterStart, inFence);
    const endMatch = endFound && { index: endFound.index - afterStart, 0: endFound[0] };

    if (endMatch) {
      // The end marker's own indentation sits in front of the match. It belongs to the marker
      // line, not to the embedded content: leaving it in existingContent both hands embeds a
      // stray trailing indent and drops it on rewrite, since the marker is re-emitted verbatim
      // after a newline. Claim it only when it is the whole of its line, so an inline end marker
      // (`| cell |`, mid-line) keeps the text before it as content.
      const indentMatch = /(?:^|\n)([ \t]+)$/.exec(
        remainingContent.slice(0, endMatch.index)
      );
      const endMarkerIndent = indentMatch?.[1] ?? '';
      const endMarkerStart = endMatch.index - endMarkerIndent.length;

      const endMarkerLine = endMarkerIndent + endMatch[0];
      const endIndex = afterStart + endMarkerStart + endMarkerLine.length;
      const existingContent = remainingContent.slice(0, endMarkerStart);

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
  commentStyle: CommentStyle,
  options: MarkerParseOptions = {}
): ParsedInlineData[] {
  const results: ParsedInlineData[] = [];
  const { start, end } = commentStyle;
  const inFence = insideRanges(options.markdown ? codeFenceRanges(content) : []);

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
    if (inFence(startIndex)) {
      continue;
    }
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
    const endFound = findOutside(endPattern, content, afterStart, inFence);
    const endMatch = endFound && { index: endFound.index - afterStart, 0: endFound[0] };

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
