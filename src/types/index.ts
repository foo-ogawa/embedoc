/**
 * embedoc Type Definitions
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Comment style definition
 */
export interface CommentStyle {
  start: string;
  end: string;
}

/**
 * Target file pattern configuration
 */
export interface TargetConfig {
  pattern: string;
  comment_style: string;
  exclude?: string[];
}

/**
 * Generator configuration
 */
export interface GeneratorConfig {
  output_path: string;
  template: string;
  overwrite?: boolean;
}

/**
 * Datasource configuration
 */
export interface DatasourceConfig {
  type: 'sqlite' | 'csv' | 'json' | 'yaml' | 'glob';
  path?: string;
  pattern?: string;
  query?: string;
  encoding?: string;
  generators?: GeneratorConfig[];
}

/**
 * Output configuration
 */
export interface OutputConfig {
  encoding?: BufferEncoding;
  line_ending?: 'lf' | 'crlf';
}

/**
 * GitHub configuration
 */
export interface GithubConfig {
  base_url?: string;
}

/**
 * Inline datasource configuration
 */
export interface InlineDatasourceConfig {
  /** Enable/disable inline datasources (default: true) */
  enabled?: boolean;
  /** Maximum size in bytes (default: 10240) */
  maxBytes?: number;
  /** Allowed formats (default: all) */
  allowedFormats?: string[];
  /** Conflict policy when inline name matches external (default: warn) */
  conflictPolicy?: 'warn' | 'error' | 'prefer_external';
  /** Allow anonymous inline data (default: false) */
  allowAnonymous?: boolean;
  /** Strip code fences from content (default: true) */
  stripCodeFences?: boolean;
  /** Custom regex patterns to strip from content start/end */
  stripPatterns?: string[];
}

/**
 * Main configuration file
 */
export interface EmbedifyConfig {
  version: string;
  targets: TargetConfig[];
  comment_styles?: Record<string, CommentStyle>;
  datasources?: Record<string, DatasourceConfig>;
  embeds_dir?: string;
  templates_dir?: string;
  output?: OutputConfig;
  github?: GithubConfig;
  /** Inline datasource configuration */
  inline_datasource?: InlineDatasourceConfig;
}

// =============================================================================
// Markers
// =============================================================================

/**
 * Parsed marker information
 */
export interface ParsedMarker {
  /** Start position of entire marker */
  startIndex: number;
  /** End position of entire marker */
  endIndex: number;
  /** Template name */
  templateName: string;
  /** Parameters (attribute values) */
  params: Record<string, string>;
  /** Existing content (between markers) */
  existingContent: string;
  /** Full start marker line */
  startMarkerLine: string;
  /** Full end marker line */
  endMarkerLine: string;
}

/**
 * Detected comment format result
 */
export interface DetectedComment {
  style: CommentStyle;
  styleName: string;
}

// =============================================================================
// Datasources
// =============================================================================

/**
 * Datasource query result
 */
export type QueryResult = Record<string, unknown>[];

/**
 * Datasource interface
 */
export interface Datasource {
  /** Datasource type */
  readonly type: string;
  /** Execute query */
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  /** Get all data (for generators) */
  getAll(): Promise<QueryResult>;
  /** Close connection */
  close(): Promise<void>;
}

/**
 * Datasource factory
 */
export type DatasourceFactory = (config: DatasourceConfig) => Promise<Datasource>;

// =============================================================================
// Embeds (Templates)
// =============================================================================

/**
 * Markdown helper
 */
export interface MarkdownHelper {
  /** Generate table */
  table(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string;
  /** Generate list */
  list(items: string[], ordered?: boolean): string;
  /** Generate code block */
  codeBlock(code: string, language?: string): string;
  /** Generate link */
  link(text: string, url: string): string;
  /** Generate heading */
  heading(text: string, level?: number): string;
  /** Bold text */
  bold(text: string): string;
  /** Italic text */
  italic(text: string): string;
  /** Checkbox */
  checkbox(checked: boolean): string;
}

/**
 * Embed context
 */
export interface EmbedContext {
  /** Marker parameters */
  params: Record<string, string>;
  /** Frontmatter properties */
  frontmatter: Record<string, unknown>;
  /** Datasource access */
  datasources: Record<string, Datasource>;
  /** Markdown helper */
  markdown: MarkdownHelper;
  /** Current file path being processed */
  filePath: string;
}

/**
 * Embed execution result
 */
export interface EmbedResult {
  content: string;
}

/**
 * Embed definition
 */
export interface EmbedDefinition {
  /** Dependent datasource names */
  dependsOn?: string[];
  /** Render function */
  render(ctx: EmbedContext): Promise<EmbedResult>;
}

/**
 * Helper function type for embed definition
 */
export type DefineEmbedFn = (definition: EmbedDefinition) => EmbedDefinition;

// =============================================================================
// Frontmatter
// =============================================================================

/**
 * Parsed frontmatter
 */
export interface ParsedFrontmatter {
  /** Frontmatter data */
  data: Record<string, unknown>;
  /** Content after frontmatter */
  content: string;
  /** Original frontmatter string (including ---) */
  raw: string;
}

// =============================================================================
// Processing Results
// =============================================================================

/**
 * File processing result
 */
export interface ProcessResult {
  /** Processed file path */
  filePath: string;
  /** Whether successful */
  success: boolean;
  /** Number of updated markers */
  markersUpdated: number;
  /** Error (if any) */
  error?: Error;
  /** Whether changed */
  changed: boolean;
}

/**
 * Generation result
 */
export interface GenerateResult {
  /** Generated file path */
  filePath: string;
  /** Whether successful */
  success: boolean;
  /** Whether skipped (existing file without overwrite) */
  skipped: boolean;
  /** Error (if any) */
  error?: Error;
}

/**
 * Build result
 */
export interface BuildResult {
  /** Number of processed files */
  totalFiles: number;
  /** Number of successful files */
  successFiles: number;
  /** Number of failed files */
  failedFiles: number;
  /** Total number of updated markers */
  totalMarkersUpdated: number;
  /** Results for each file */
  results: ProcessResult[];
  /** Processing time (milliseconds) */
  duration: number;
}

// =============================================================================
// CLI
// =============================================================================

/**
 * CLI options
 */
export interface CLIOptions {
  config?: string;
  dryRun?: boolean;
  verbose?: boolean;
  datasource?: string;
  generator?: string;
  all?: boolean;
}
