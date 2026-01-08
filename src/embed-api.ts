/**
 * embedoc Embed API
 *
 * This module exports all types and functions needed for writing custom embeds.
 *
 * @example
 * ```typescript
 * import { defineEmbed, type EmbedContext, type EmbedResult } from 'embedoc';
 *
 * export default defineEmbed({
 *   dependsOn: ['my_datasource'],
 *   async render(ctx: EmbedContext): Promise<EmbedResult> {
 *     const data = await ctx.datasources.my_datasource.query('SELECT * FROM table');
 *     return { content: ctx.markdown.table(['Column'], data.map(r => [r.name])) };
 *   }
 * });
 * ```
 *
 * @packageDocumentation
 */

// Re-export types for embed authors
export type {
  /**
   * Embed definition interface.
   * Use with {@link defineEmbed} to create custom embeds.
   */
  EmbedDefinition,

  /**
   * Context object passed to the embed's render function.
   * Provides access to parameters, datasources, and helpers.
   */
  EmbedContext,

  /**
   * Result returned from an embed's render function.
   */
  EmbedResult,

  /**
   * Helper interface for generating Markdown content.
   */
  MarkdownHelper,

  /**
   * Datasource interface for querying data.
   */
  Datasource,

  /**
   * Query result type (array of records).
   */
  QueryResult,
} from './types/index.js';

// Re-export defineEmbed function
export { defineEmbed } from './index.js';

