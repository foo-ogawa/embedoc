/**
 * embedoc - In-Place Document Generator
 *
 * @example
 * ```typescript
 * import { defineEmbed, build, generateAll } from 'embedoc';
 *
 * const myEmbed = defineEmbed({
 *   dependsOn: ['my_datasource'],
 *   async render(ctx) {
 *     const data = await ctx.datasources.my_datasource.query('SELECT * FROM table');
 *     return { content: ctx.markdown.table(['Column'], data.map(r => [r.name])) };
 *   }
 * });
 * ```
 */

// Type exports
export type {
  // Configuration
  CommentStyle,
  TargetConfig,
  GeneratorConfig,
  DatasourceConfig,
  OutputConfig,
  GithubConfig,
  EmbedifyConfig,
  InlineDatasourceConfig,
  // Markers
  ParsedMarker,
  DetectedComment,
  // Datasources
  QueryResult,
  Datasource,
  DatasourceFactory,
  // Embeds
  MarkdownHelper,
  EmbedContext,
  EmbedResult,
  EmbedDefinition,
  DefineEmbedFn,
  // Frontmatter
  ParsedFrontmatter,
  // Results
  ProcessResult,
  GenerateResult,
  BuildResult,
  CLIOptions,
} from './types/index.js';

// Core functions
export { build, processFile } from './core/processor.js';
export { generateAll, generateFromDatasource } from './core/generator.js';
export {
  parseMarkers,
  parseFrontmatter,
  parseAttributes,
  resolveVariables,
  getCommentStyle,
  guessCommentStyle,
  parseInlineDataMarkers,
  DEFAULT_COMMENT_STYLES,
} from './core/parser.js';

// Inline datasource
export {
  InlineDatasource,
  buildInlineDatasources,
  parseDotPath,
  resolveDotPath,
  setDotPath,
  getRootName,
  parseInlineContent,
} from './core/inline-datasource.js';
export type { ParsedInlineData, ContentProcessingOptions } from './core/inline-datasource.js';
export { DependencyGraph } from './core/dependency.js';
export type { DependencyType, DependencyNode } from './core/dependency.js';

// Datasources
export {
  createDatasource,
  initializeDatasources,
  closeDatasources,
  SqliteDatasource,
  CsvDatasource,
  JsonDatasource,
  YamlDatasource,
  GlobDatasource,
} from './datasources/index.js';

// Helpers
export { createMarkdownHelper } from './helpers/markdown.js';

// Embed definition helper function
import type { EmbedDefinition, DefineEmbedFn } from './types/index.js';

/**
 * Define a custom embed for generating content in documents.
 *
 * Embeds are TypeScript modules that generate content for markers
 * in your documents. Use this function to create type-safe embed definitions.
 *
 * @param definition - The embed definition object
 * @returns The same definition object (for type inference)
 *
 * @example Basic embed
 * ```typescript
 * import { defineEmbed } from 'embedoc';
 *
 * export default defineEmbed({
 *   dependsOn: ['metadata_db'],
 *   async render(ctx) {
 *     const { id } = ctx.params;
 *     const data = await ctx.datasources['metadata_db'].query(
 *       'SELECT * FROM tables WHERE name = ?',
 *       [id]
 *     );
 *     return { content: ctx.markdown.table(['Name'], data.map(r => [r.name])) };
 *   }
 * });
 * ```
 *
 * @example Embed with multiple datasources
 * ```typescript
 * import { defineEmbed } from 'embedoc';
 *
 * export default defineEmbed({
 *   dependsOn: ['users_db', 'config'],
 *   async render(ctx) {
 *     const users = await ctx.datasources['users_db'].getAll();
 *     const config = await ctx.datasources['config'].getAll();
 *
 *     return {
 *       content: ctx.markdown.table(
 *         ['Name', 'Role'],
 *         users.map(u => [u.name, u.role])
 *       )
 *     };
 *   }
 * });
 * ```
 *
 * @example Embed using frontmatter and parameters
 * ```typescript
 * import { defineEmbed } from 'embedoc';
 *
 * export default defineEmbed({
 *   async render(ctx) {
 *     // Access marker parameters: <!--@embedoc:my_embed title="Hello"-->
 *     const { title } = ctx.params;
 *
 *     // Access document frontmatter
 *     const author = ctx.frontmatter['author'] as string;
 *
 *     return {
 *       content: ctx.markdown.heading(title, 2) + '\n\nBy ' + author
 *     };
 *   }
 * });
 * ```
 *
 * @see {@link EmbedDefinition} for the definition interface
 * @see {@link EmbedContext} for the context object passed to render
 * @see {@link MarkdownHelper} for markdown generation utilities
 */
export const defineEmbed: DefineEmbedFn = (definition: EmbedDefinition) => definition;

/**
 * Alias for {@link defineEmbed}.
 * @deprecated Use `defineEmbed` instead for consistency.
 */
export const defineTemplate = defineEmbed;
