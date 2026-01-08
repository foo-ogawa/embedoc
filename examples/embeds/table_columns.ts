/**
 * table_columns Embed
 * Output table column information as a Markdown table
 */

import { defineEmbed } from 'embedoc';

export default defineEmbed({
  // Datasources this embed depends on
  dependsOn: ['metadata_db'],

  async render(ctx) {
    // Get table name from parameters
    const { id } = ctx.params;

    if (!id) {
      return { content: '❌ Error: id parameter is required' };
    }

    // Get column information from datasource
    const columns = await ctx.datasources['metadata_db']!.query(
      `SELECT * FROM columns WHERE table_name = ? ORDER BY ordinal_position`,
      [id]
    );

    if (columns.length === 0) {
      return { content: `⚠️ No columns found for table: ${id}` };
    }

    // Generate Markdown table
    const markdown = ctx.markdown.table(
      ['Column Name', 'Type', 'NOT NULL', 'Default', 'Comment'],
      columns.map((col) => [
        col['column_name'] as string,
        col['data_type'] as string,
        col['not_null'] ? '✔' : '',
        (col['default_value'] as string) ?? 'NULL',
        (col['column_comment'] as string) ?? '',
      ])
    );

    return { content: markdown };
  },
});
