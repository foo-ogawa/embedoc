/**
 * table_relations Embed
 * Output table dependencies as a Mermaid diagram
 */

import { defineEmbed } from 'embedoc';

export default defineEmbed({
  dependsOn: ['metadata_db'],

  async render(ctx) {
    const { id } = ctx.params;

    if (!id) {
      return { content: '❌ Error: id parameter is required' };
    }

    // Get foreign key information
    const relations = await ctx.datasources['metadata_db']!.query(
      `SELECT * FROM foreign_keys WHERE table_name = ? OR ref_table_name = ?`,
      [id, id]
    );

    if (relations.length === 0) {
      return { content: `⚠️ No relations found for table: ${id}` };
    }

    // Generate Mermaid diagram directly
    const nodes = new Set<string>();
    const edges: string[] = [];

    nodes.add(id);

    for (const rel of relations) {
      const tableName = rel['table_name'] as string;
      const refTableName = rel['ref_table_name'] as string;
      const columnName = rel['column_name'] as string;

      if (tableName === id) {
        nodes.add(refTableName);
        edges.push(`  ${id} -->|"${columnName}"| ${refTableName}`);
      } else {
        nodes.add(tableName);
        edges.push(`  ${tableName} -->|"${columnName}"| ${id}`);
      }
    }

    // Node definitions (database shape)
    const nodeLines = Array.from(nodes).map(
      (node) => `  ${node}[("${node === id ? `**${node}**` : node}")]`
    );

    const mermaid = ctx.markdown.codeBlock(
      `flowchart LR\n${nodeLines.join('\n')}\n${edges.join('\n')}`,
      'mermaid'
    );

    return { content: mermaid };
  },
});
