/**
 * table_index Embed
 * Output table list with links
 */

import { defineEmbed } from '../../dist/index.js';

export default defineEmbed({
  dependsOn: ['metadata_db'],

  async render(ctx) {
    // Get table list
    const tables = await ctx.datasources['metadata_db']!.query(
      `SELECT table_name, schema_name, table_comment FROM tables ORDER BY table_name`
    );

    if (tables.length === 0) {
      return { content: '⚠️ No tables found' };
    }

    // Generate Markdown table with links
    const markdown = ctx.markdown.table(
      ['Table Name', 'Schema', 'Description'],
      tables.map((t) => [
        ctx.markdown.link(
          t['table_name'] as string,
          `./tables/${t['table_name']}.md`
        ),
        t['schema_name'] as string,
        (t['table_comment'] as string) ?? '',
      ])
    );

    return { content: markdown };
  },
});
