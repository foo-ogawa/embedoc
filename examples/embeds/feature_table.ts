/**
 * feature_table Embed
 * Display a feature list from inline datasource as a table
 *
 * Usage: <!--@embedoc:feature_table datasource="feature_list"-->
 *
 * Parameters:
 *   - datasource: Name of the inline datasource containing features array
 */

import { defineEmbed } from '../../dist/index.js';

interface Feature {
  name: string;
  description: string;
  status: string;
}

export default defineEmbed({
  async render(ctx) {
    const datasourceName = ctx.params['datasource'];

    if (!datasourceName) {
      return { content: '⚠️ `datasource` parameter is required' };
    }

    const ds = ctx.datasources[datasourceName];
    if (!ds) {
      return { content: `⚠️ Datasource "${datasourceName}" not found` };
    }

    const features = (await ds.getAll()) as Feature[];

    if (!Array.isArray(features) || features.length === 0) {
      return { content: '⚠️ No features found in datasource' };
    }

    // Generate table rows
    const rows = features.map((f) => {
      const statusBadge =
        f.status === 'stable'
          ? '✅ stable'
          : f.status === 'beta'
            ? '🔶 beta'
            : f.status === 'experimental'
              ? '🧪 experimental'
              : f.status;

      return `| ${f.name} | ${f.description} | ${statusBadge} |`;
    });

    return { content: rows.join('\n') };
  },
});

