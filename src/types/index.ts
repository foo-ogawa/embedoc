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
 * Query result returned from datasource operations.
 *
 * An array of records, where each record is an object with string keys
 * and unknown values. Use type assertions when accessing specific fields.
 *
 * @example
 * ```typescript
 * const users = await ctx.datasources.db.query('SELECT * FROM users');
 * users.forEach(user => {
 *   console.log(user['name'] as string);
 *   console.log(user['age'] as number);
 * });
 * ```
 */
export type QueryResult = Record<string, unknown>[];

/**
 * Datasource interface for accessing external data.
 *
 * Datasources are configured in `embedoc.config.yaml` and accessed
 * via `ctx.datasources` in embed render functions.
 *
 * **Note**: The `query` option in config is for **generators** (file generation).
 * In embeds, use `query()` method to execute **dynamic queries with parameters**
 * from marker attributes or frontmatter.
 *
 * Supported datasource types:
 * - `sqlite` - SQLite database (supports parameterized queries)
 * - `csv` - CSV files (use `getAll()`)
 * - `json` - JSON files (use `getAll()`)
 * - `yaml` - YAML files (use `getAll()`)
 * - `glob` - File listings (use `getAll()`)
 *
 * @example
 * ```typescript
 * // In your embed's render function
 * const ds = ctx.datasources['metadata_db'];
 *
 * // SQLite: dynamic query with marker parameters
 * const { id } = ctx.params;  // From: <!--@embedoc:my_embed id="users"-->
 * const rows = await ds.query(
 *   'SELECT * FROM columns WHERE table_name = ?',
 *   [id]
 * );
 *
 * // CSV/JSON/YAML: get all data
 * const allData = await ds.getAll();
 * ```
 */
export interface Datasource {
  /**
   * Datasource type identifier.
   * One of: 'sqlite', 'csv', 'json', 'yaml', 'glob', 'inline'
   */
  readonly type: string;

  /**
   * Execute a parameterized query on the datasource.
   *
   * **SQLite**: Execute SQL with parameters from marker attributes or frontmatter.
   * This allows dynamic filtering based on the document context.
   *
   * **CSV/JSON/YAML/Glob**: Parameters are ignored; use `getAll()` instead.
   *
   * @param sql - SQL query string with `?` placeholders for parameters
   * @param params - Values to bind to the placeholders (prevents SQL injection)
   * @returns Promise resolving to an array of records
   *
   * @example
   * ```typescript
   * // Dynamic query using marker parameter
   * const { id } = ctx.params;  // From: <!--@embedoc:table_columns id="users"-->
   * const columns = await ds.query(
   *   'SELECT * FROM columns WHERE table_name = ? ORDER BY ordinal_position',
   *   [id]
   * );
   *
   * // Multiple parameters
   * const filtered = await ds.query(
   *   'SELECT * FROM users WHERE status = ? AND role = ?',
   *   [ctx.params['status'], ctx.params['role']]
   * );
   * ```
   */
  query(sql: string, params?: unknown[]): Promise<QueryResult>;

  /**
   * Get all data from the datasource.
   *
   * Returns all records without filtering. Recommended for
   * CSV, JSON, YAML, and Glob datasources.
   *
   * @returns Promise resolving to an array of all records
   *
   * @example
   * ```typescript
   * // CSV datasource
   * const endpoints = await ctx.datasources['api_endpoints'].getAll();
   *
   * // JSON datasource
   * const config = await ctx.datasources['config'].getAll();
   * ```
   */
  getAll(): Promise<QueryResult>;

  /**
   * @internal
   * Close the datasource connection.
   * Called automatically by embedoc - do not call manually.
   */
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
 * Helper interface for generating Markdown content.
 *
 * Always available via `ctx.markdown` in embed render functions.
 * Provides methods for creating common Markdown elements:
 *
 * @example
 * ```typescript
 * export default defineEmbed({
 *   async render(ctx) {
 *     const { markdown } = ctx;
 *
 *     // Create a table
 *     const table = markdown.table(
 *       ['Name', 'Age'],
 *       [['Alice', 25], ['Bob', 30]]
 *     );
 *
 *     // Create a list
 *     const list = markdown.list(['Item 1', 'Item 2'], false);
 *
 *     return { content: table + '\n\n' + list };
 *   }
 * });
 * ```
 */
export interface MarkdownHelper {
  /**
   * Generate a Markdown table.
   *
   * @param headers - Array of column header strings
   * @param rows - 2D array of cell values (each inner array is a row)
   * @returns Formatted Markdown table string
   *
   * @example
   * ```typescript
   * ctx.markdown.table(
   *   ['Column', 'Type', 'Description'],
   *   [
   *     ['id', 'integer', 'Primary key'],
   *     ['name', 'varchar', 'User name'],
   *   ]
   * );
   * // Output:
   * // | Column | Type | Description |
   * // | --- | --- | --- |
   * // | id | integer | Primary key |
   * // | name | varchar | User name |
   * ```
   */
  table(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string;

  /**
   * Generate a Markdown list.
   *
   * @param items - Array of list item strings
   * @param ordered - If true, creates numbered list; if false, creates bullet list
   * @returns Formatted Markdown list string
   *
   * @example
   * ```typescript
   * // Unordered list
   * ctx.markdown.list(['Apple', 'Banana', 'Cherry'], false);
   * // Output:
   * // - Apple
   * // - Banana
   * // - Cherry
   *
   * // Ordered list
   * ctx.markdown.list(['First', 'Second', 'Third'], true);
   * // Output:
   * // 1. First
   * // 2. Second
   * // 3. Third
   * ```
   */
  list(items: string[], ordered?: boolean): string;

  /**
   * Generate a fenced code block.
   *
   * @param code - The code content
   * @param language - Optional language identifier for syntax highlighting
   * @returns Formatted Markdown code block string
   *
   * @example
   * ```typescript
   * ctx.markdown.codeBlock('const x = 1;', 'typescript');
   * // Output:
   * // ```typescript
   * // const x = 1;
   * // ```
   * ```
   */
  codeBlock(code: string, language?: string): string;

  /**
   * Generate a Markdown link.
   *
   * @param text - Link display text
   * @param url - Link URL
   * @returns Formatted Markdown link string
   *
   * @example
   * ```typescript
   * ctx.markdown.link('Visit Google', 'https://google.com');
   * // Output: [Visit Google](https://google.com)
   * ```
   */
  link(text: string, url: string): string;

  /**
   * Generate a Markdown heading.
   *
   * @param text - Heading text
   * @param level - Heading level (1-6), defaults to 1
   * @returns Formatted Markdown heading string
   *
   * @example
   * ```typescript
   * ctx.markdown.heading('Section Title', 2);
   * // Output: ## Section Title
   * ```
   */
  heading(text: string, level?: number): string;

  /**
   * Wrap text in bold formatting.
   *
   * @param text - Text to make bold
   * @returns Bold formatted string
   *
   * @example
   * ```typescript
   * ctx.markdown.bold('Important');
   * // Output: **Important**
   * ```
   */
  bold(text: string): string;

  /**
   * Wrap text in italic formatting.
   *
   * @param text - Text to make italic
   * @returns Italic formatted string
   *
   * @example
   * ```typescript
   * ctx.markdown.italic('Emphasis');
   * // Output: *Emphasis*
   * ```
   */
  italic(text: string): string;

  /**
   * Generate a checkbox character.
   *
   * @param checked - Whether the checkbox is checked
   * @returns Checkbox character ('✔' if checked, '' if not)
   *
   * @example
   * ```typescript
   * ctx.markdown.checkbox(true);   // Output: ✔
   * ctx.markdown.checkbox(false);  // Output: (empty string)
   * ```
   */
  checkbox(checked: boolean): string;
}

/**
 * Context object passed to an embed's render function.
 *
 * Provides access to:
 * - Marker parameters from the document
 * - Document frontmatter data
 * - Configured datasources
 * - Markdown generation helpers
 * - Current file path
 *
 * @example
 * ```typescript
 * export default defineEmbed({
 *   dependsOn: ['metadata_db'],
 *   async render(ctx) {
 *     // Access marker parameters
 *     const { id } = ctx.params;  // From: <!--@embedoc:my_embed id="users"-->
 *
 *     // Access frontmatter
 *     const docType = ctx.frontmatter['doc_type'];
 *
 *     // Query datasource
 *     const data = await ctx.datasources['metadata_db'].query(
 *       'SELECT * FROM tables WHERE name = ?',
 *       [id]
 *     );
 *
 *     // Generate markdown
 *     return { content: ctx.markdown.table(['Name'], data.map(r => [r.name])) };
 *   }
 * });
 * ```
 */
export interface EmbedContext {
  /**
   * Parameters from the marker attributes.
   *
   * Parsed from the marker syntax:
   * `<!--@embedoc:embed_name param1="value1" param2="value2"-->`
   *
   * Variable references (`${...}`) are resolved before passing to the embed.
   *
   * @example
   * ```typescript
   * // Marker: <!--@embedoc:table_columns id="users" schema="public"-->
   * const { id, schema } = ctx.params;
   * // id = "users", schema = "public"
   * ```
   */
  params: Record<string, string>;

  /**
   * Frontmatter data from the document.
   *
   * Parsed from YAML frontmatter at the top of the document.
   *
   * @example
   * ```typescript
   * // Document frontmatter:
   * // ---
   * // doc_id: "users"
   * // schema: "public"
   * // ---
   *
   * const docId = ctx.frontmatter['doc_id'] as string;
   * ```
   */
  frontmatter: Record<string, unknown>;

  /**
   * Map of configured datasources.
   *
   * Keys are datasource names from `embedoc.config.yaml`.
   * Includes both external datasources and inline datasources
   * defined in the document.
   *
   * @example
   * ```typescript
   * // Access SQLite datasource
   * const db = ctx.datasources['metadata_db'];
   * const rows = await db.query('SELECT * FROM users');
   *
   * // Access inline datasource
   * const config = ctx.datasources['project_config'];
   * const data = await config.getAll();
   * ```
   */
  datasources: Record<string, Datasource>;

  /**
   * Markdown generation helper.
   *
   * Always available. Provides methods for creating tables, lists,
   * code blocks, links, and other Markdown elements.
   *
   * @see {@link MarkdownHelper}
   */
  markdown: MarkdownHelper;

  /**
   * Absolute path to the current file being processed.
   *
   * Useful for generating relative links or file references.
   *
   * @example
   * ```typescript
   * const dir = path.dirname(ctx.filePath);
   * const relativePath = path.relative(dir, targetFile);
   * ```
   */
  filePath: string;
}

/**
 * Result object returned from an embed's render function.
 *
 * @example
 * ```typescript
 * export default defineEmbed({
 *   async render(ctx): Promise<EmbedResult> {
 *     return { content: '# Generated Content\n\nHello, World!' };
 *   }
 * });
 * ```
 */
export interface EmbedResult {
  /**
   * Generated content to insert between the markers.
   *
   * This string replaces the existing content between
   * the start and end markers in the document.
   */
  content: string;
}

/**
 * Embed definition interface.
 *
 * Use with {@link defineEmbed} to create custom embeds.
 * Embeds are TypeScript modules that generate content
 * for markers in your documents.
 *
 * @example
 * ```typescript
 * import { defineEmbed } from 'embedoc';
 *
 * export default defineEmbed({
 *   // Declare datasource dependencies for incremental builds
 *   dependsOn: ['metadata_db'],
 *
 *   // Render function generates the content
 *   async render(ctx) {
 *     const { id } = ctx.params;
 *     const data = await ctx.datasources['metadata_db'].query(
 *       'SELECT * FROM users WHERE id = ?',
 *       [id]
 *     );
 *     return {
 *       content: ctx.markdown.table(['Name', 'Email'], data.map(r => [r.name, r.email]))
 *     };
 *   }
 * });
 * ```
 */
export interface EmbedDefinition {
  /**
   * List of datasource names this embed depends on.
   *
   * Used for dependency tracking in incremental builds.
   * When a datasource changes, all documents using embeds
   * that depend on it will be rebuilt.
   *
   * @example
   * ```typescript
   * dependsOn: ['metadata_db', 'api_endpoints']
   * ```
   */
  dependsOn?: string[];

  /**
   * Render function that generates the embed content.
   *
   * Called for each marker in the document that references this embed.
   * Receives the context object with parameters, datasources, and helpers.
   *
   * @param ctx - The embed context
   * @returns Promise resolving to the embed result with generated content
   */
  render(ctx: EmbedContext): Promise<EmbedResult>;
}

/**
 * Helper function type for defining embeds.
 *
 * Used internally by {@link defineEmbed}.
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
