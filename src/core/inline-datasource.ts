/**
 * Inline Datasource
 * Document-local datasources defined with @embedoc-data markers
 */

import yaml from 'js-yaml';
import path from 'node:path';
import type { Datasource, QueryResult } from '../types/index.js';

/**
 * Parsed inline data marker
 */
export interface ParsedInlineData {
  /** Datasource name (may contain dots for nested paths) */
  name: string;
  /** Data format */
  format: 'yaml' | 'json' | 'csv' | 'table' | 'text';
  /** Raw content between markers */
  content: string;
  /** Start line number (for error reporting) */
  startLine: number;
  /** End line number (for error reporting) */
  endLine: number;
  /** Byte size of content */
  byteSize: number;
}

/**
 * Location metadata for an inline definition
 */
export interface InlineDefinitionLocation {
  /** Property path ('' for root definition) */
  propertyPath: string;
  /** Absolute file path */
  absolutePath: string;
  /** Relative path from target document (calculated on access) */
  relativePath: string;
  /** Marker start line (1-indexed) */
  startLine: number;
  /** Marker end line */
  endLine: number;
  /** Content start line (excluding marker) */
  contentStartLine: number;
  /** Content end line (excluding marker) */
  contentEndLine: number;
  /** Data format */
  format: string;
}

/**
 * Inline datasource configuration
 */
export interface InlineDatasourceConfig {
  enabled?: boolean;
  maxBytes?: number;
  allowedFormats?: string[];
  conflictPolicy?: 'warn' | 'error' | 'prefer_external';
  allowAnonymous?: boolean;
  /** Strip code fences from content (default: true) */
  stripCodeFences?: boolean;
  /** Custom patterns to strip from content start/end (regex strings) */
  stripPatterns?: string[];
}

/**
 * Default strip patterns for code fences
 */
const DEFAULT_STRIP_PATTERNS = [
  '^```\\w*\\s*\\n?',  // Opening fence: ``` or ```language
  '\\n?```\\s*$',       // Closing fence: ```
];

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<Omit<InlineDatasourceConfig, 'stripPatterns'>> & { stripPatterns: string[] } = {
  enabled: true,
  maxBytes: 10240, // 10KB
  allowedFormats: ['yaml', 'json', 'csv', 'table', 'text'],
  conflictPolicy: 'warn',
  allowAnonymous: false,
  stripCodeFences: true,
  stripPatterns: DEFAULT_STRIP_PATTERNS,
};

/**
 * Parse dot-path into segments
 * "author.repos[0].name" → ["author", "repos", 0, "name"]
 */
export function parseDotPath(path: string): (string | number)[] {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((s) => s.length > 0)
    .map((s) => (/^\d+$/.test(s) ? parseInt(s, 10) : s));
}

/**
 * Resolve dot-path on an object
 */
export function resolveDotPath(obj: unknown, path: string): unknown {
  const segments = parseDotPath(path);
  let current = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof segment === 'number') {
      current = (current as unknown[])[segment];
    } else {
      current = (current as Record<string, unknown>)[segment];
    }
  }

  return current;
}

/**
 * Set value at dot-path, creating intermediate objects as needed
 */
export function setDotPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const segments = parseDotPath(path);
  if (segments.length === 0) return;
  
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]!;
    const nextSegment = segments[i + 1];

    if (typeof segment === 'number') {
      throw new Error(`Array index in middle of path not supported: ${path}`);
    }

    if (!(segment in current)) {
      // Create intermediate object or array based on next segment
      current[segment] = typeof nextSegment === 'number' ? [] : {};
    }

    current = current[segment] as Record<string, unknown>;
  }

  const lastSegment = segments[segments.length - 1]!;
  if (typeof lastSegment === 'number') {
    (current as unknown as unknown[])[lastSegment] = value;
  } else {
    current[lastSegment] = value;
  }
}

/**
 * Get root name from dot-path
 * "project.author.name" → "project"
 */
export function getRootName(path: string): string {
  const firstDot = path.indexOf('.');
  return firstDot === -1 ? path : path.slice(0, firstDot);
}

/**
 * Strip patterns from content
 * @param content - Content to process
 * @param patterns - Array of regex pattern strings to strip
 */
function stripPatterns(content: string, patterns: string[]): string {
  let result = content.trim();
  
  for (const pattern of patterns) {
    const regex = new RegExp(pattern);
    result = result.replace(regex, '');
  }
  
  return result.trim();
}

/**
 * Content processing options
 */
export interface ContentProcessingOptions {
  stripCodeFences?: boolean;
  stripPatterns?: string[];
}

/**
 * Parse content based on format
 * @param content - Raw content string
 * @param format - Content format (yaml, json, csv, table, text)
 * @param options - Processing options
 */
export function parseInlineContent(
  content: string,
  format: string,
  options: ContentProcessingOptions = {}
): unknown {
  const { 
    stripCodeFences = true,
    stripPatterns: customPatterns 
  } = options;
  
  let processed = content;
  
  // Strip patterns if enabled
  if (stripCodeFences) {
    const patterns = customPatterns ?? DEFAULT_STRIP_PATTERNS;
    processed = stripPatterns(processed, patterns);
  }
  
  const trimmed = processed.trim();

  switch (format) {
    case 'yaml':
      // Use JSON_SCHEMA for safe loading (no custom tags)
      return yaml.load(trimmed, { schema: yaml.JSON_SCHEMA }) ?? {};

    case 'json':
      return trimmed ? JSON.parse(trimmed) : {};

    case 'csv':
      return parseCSV(trimmed);

    case 'table':
      return parseMarkdownTable(trimmed);

    case 'text':
    default:
      return trimmed;
  }
}

/**
 * Parse CSV content
 */
function parseCSV(content: string): QueryResult {
  const lines = content.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headerLine = lines[0];
  if (!headerLine) return [];
  
  const headers = headerLine.split(',').map((h) => h.trim());
  const rows: QueryResult = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const values = line.split(',').map((v) => v.trim());
    const row: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Parse Markdown table content
 */
function parseMarkdownTable(content: string): QueryResult {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.match(/^\|[-:| ]+\|$/));

  if (lines.length === 0) return [];

  // Parse header
  const headerLine = lines[0];
  if (!headerLine) return [];
  
  const headers = headerLine
    .split('|')
    .map((h) => h.trim())
    .filter((h) => h.length > 0);

  // Parse rows
  const rows: QueryResult = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    
    const allValues = line.split('|').map((v) => v.trim());
    
    // Filter empty first/last from pipe-delimited
    const cleanValues = line.startsWith('|') 
      ? allValues.slice(1, -1)
      : allValues;

    const row: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      row[header] = cleanValues[idx] ?? '';
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Internal location data (without relativePath calculation)
 */
interface InternalLocation {
  propertyPath: string;
  startLine: number;
  endLine: number;
  format: string;
}

/**
 * Inline Datasource class
 */
export class InlineDatasource implements Datasource {
  readonly type = 'inline';
  readonly format: string;
  readonly documentPath: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly byteSize: number;

  /** Internal data - exposed for variable resolution */
  readonly data: unknown;
  private _isObject: boolean;
  
  /** Internal location storage (sorted by propertyPath) */
  private _locations: InternalLocation[];

  constructor(
    data: unknown,
    format: string,
    documentPath: string,
    startLine: number,
    endLine: number,
    byteSize: number,
    locations: InternalLocation[] = []
  ) {
    this.data = data;
    this.format = format;
    this.documentPath = documentPath;
    this.startLine = startLine;
    this.endLine = endLine;
    this.byteSize = byteSize;
    this._isObject = !Array.isArray(data) && typeof data === 'object' && data !== null;
    // Sort locations by propertyPath ('' first, then alphabetical)
    this._locations = [...locations].sort((a, b) => {
      if (a.propertyPath === '') return -1;
      if (b.propertyPath === '') return 1;
      return a.propertyPath.localeCompare(b.propertyPath);
    });
  }

  /**
   * Query is not fully supported for inline datasources
   * Returns all data or filters by simple conditions
   */
  async query(_sql: string, _params?: unknown[]): Promise<QueryResult> {
    // For inline datasources, query just returns all data as array
    if (Array.isArray(this.data)) {
      return this.data as QueryResult;
    }
    // Wrap object in array for compatibility
    return [this.data as Record<string, unknown>];
  }

  /**
   * Get all data - returns array for Datasource interface compatibility
   */
  async getAll(): Promise<QueryResult> {
    if (Array.isArray(this.data)) {
      return this.data as QueryResult;
    }
    // Wrap object in array for compatibility
    return [this.data as Record<string, unknown>];
  }

  /**
   * Get raw data (object or array)
   */
  getRawData(): unknown {
    return this.data;
  }

  /**
   * Get value at dot-path
   */
  async get(dotPath: string): Promise<unknown> {
    return resolveDotPath(this.data, dotPath);
  }

  /**
   * Check if datasource is object type (vs array)
   */
  isObjectType(): boolean {
    return this._isObject;
  }

  /**
   * Close (no-op for inline)
   */
  async close(): Promise<void> {
    // No-op
  }

  /**
   * Merge another value into this datasource at a path
   */
  merge(dotPath: string, value: unknown): void {
    if (!this._isObject) {
      throw new Error('Cannot merge into array datasource');
    }
    setDotPath(this.data as Record<string, unknown>, dotPath, value);
  }

  /**
   * Get location metadata for a specific property definition
   * @param propertyPath - Property path to look up (default: '' for root)
   * @param targetDocPath - Base path for relative path calculation
   * @returns Location metadata or null if not found
   */
  getMeta(propertyPath: string = '', targetDocPath?: string): InlineDefinitionLocation | null {
    const loc = this._locations.find(l => l.propertyPath === propertyPath);
    if (!loc) return null;
    
    return this._buildLocation(loc, targetDocPath);
  }

  /**
   * Get all definition locations with relative paths calculated
   * @param targetDocPath - Base path for relative path calculation
   * @returns Array of all definition locations (sorted by propertyPath)
   */
  getAllMeta(targetDocPath?: string): InlineDefinitionLocation[] {
    return this._locations.map(loc => this._buildLocation(loc, targetDocPath));
  }

  /**
   * Get the locations array (read-only access for inspection)
   */
  get locations(): readonly InternalLocation[] {
    return this._locations;
  }

  /**
   * Build full location object with relativePath calculation
   */
  private _buildLocation(loc: InternalLocation, targetDocPath?: string): InlineDefinitionLocation {
    let relativePath = this.documentPath;
    if (targetDocPath) {
      const targetDir = path.dirname(targetDocPath);
      relativePath = path.relative(targetDir, this.documentPath);
      // Ensure forward slashes for consistency
      relativePath = relativePath.replace(/\\/g, '/');
      // Add ./ prefix if not starting with . or /
      if (!relativePath.startsWith('.') && !relativePath.startsWith('/')) {
        relativePath = './' + relativePath;
      }
    }

    return {
      propertyPath: loc.propertyPath,
      absolutePath: this.documentPath,
      relativePath,
      startLine: loc.startLine,
      endLine: loc.endLine,
      contentStartLine: loc.startLine + 1,
      contentEndLine: loc.endLine - 1,
      format: loc.format,
    };
  }
}

/**
 * Build inline datasources from parsed markers
 */
export function buildInlineDatasources(
  parsedData: ParsedInlineData[],
  documentPath: string,
  config: InlineDatasourceConfig = {}
): Map<string, InlineDatasource> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const datasources = new Map<string, InlineDatasource>();

  // Content processing options
  const contentOptions: ContentProcessingOptions = {
    stripCodeFences: mergedConfig.stripCodeFences,
    stripPatterns: config.stripPatterns ?? DEFAULT_STRIP_PATTERNS,
  };

  // Group by root name
  const byRoot = new Map<string, ParsedInlineData[]>();

  for (const data of parsedData) {
    // Validate size
    if (data.byteSize > mergedConfig.maxBytes) {
      throw new Error(
        `Inline datasource "${data.name}" exceeds max size (${data.byteSize} > ${mergedConfig.maxBytes} bytes)`
      );
    }

    // Validate format
    if (!mergedConfig.allowedFormats.includes(data.format)) {
      throw new Error(
        `Inline datasource "${data.name}" uses disallowed format "${data.format}"`
      );
    }

    const rootName = getRootName(data.name);
    if (!byRoot.has(rootName)) {
      byRoot.set(rootName, []);
    }
    byRoot.get(rootName)!.push(data);
  }

  // Process each root
  for (const [rootName, items] of byRoot) {
    // Check if there's a root-level definition (no dots)
    const rootItem = items.find((item) => item.name === rootName);
    
    let baseData: unknown;
    let format = 'yaml';
    let startLine = 0;
    let endLine = 0;
    let byteSize = 0;
    
    // Collect location information for each definition
    const locations: InternalLocation[] = [];

    if (rootItem) {
      // Parse root-level data
      baseData = parseInlineContent(rootItem.content, rootItem.format, contentOptions);
      format = rootItem.format;
      startLine = rootItem.startLine;
      endLine = rootItem.endLine;
      byteSize = rootItem.byteSize;
      
      // Add root location
      locations.push({
        propertyPath: '',
        startLine: rootItem.startLine,
        endLine: rootItem.endLine,
        format: rootItem.format,
      });
    } else {
      // Create empty object for dot-path only definitions
      baseData = {};
    }

    // Apply dot-path definitions
    for (const item of items) {
      if (item.name !== rootName && item.name.startsWith(rootName + '.')) {
        const subPath = item.name.slice(rootName.length + 1);
        const value = parseInlineContent(item.content, item.format, contentOptions);
        
        if (typeof baseData !== 'object' || baseData === null) {
          baseData = {};
        }
        setDotPath(baseData as Record<string, unknown>, subPath, value);
        
        // Add property location
        locations.push({
          propertyPath: subPath,
          startLine: item.startLine,
          endLine: item.endLine,
          format: item.format,
        });
        
        // Update overall metadata
        if (startLine === 0 || item.startLine < startLine) {
          startLine = item.startLine;
        }
        if (item.endLine > endLine) {
          endLine = item.endLine;
        }
        byteSize += item.byteSize;
      }
    }

    datasources.set(
      rootName,
      new InlineDatasource(baseData, format, documentPath, startLine, endLine, byteSize, locations)
    );
  }

  return datasources;
}

