/**
 * inline_value Embed
 * Display a value from inline datasource with optional formatting
 *
 * Usage: <!--@embedify:inline_value datasource="project" path="author.name"-->
 *
 * Parameters:
 *   - datasource: Name of the inline datasource
 *   - path: Dot-path to the value (optional, uses root if not specified)
 *   - format: Output format - text, code, bold, italic (default: text)
 */

import { defineEmbed } from '../../dist/index.js';

export default defineEmbed({
  async render(ctx) {
    const datasourceName = ctx.params['datasource'];
    const path = ctx.params['path'];
    const format = ctx.params['format'] || 'text';

    if (!datasourceName) {
      return { content: '⚠️ `datasource` parameter is required' };
    }

    const ds = ctx.datasources[datasourceName];
    if (!ds) {
      return { content: `⚠️ Datasource "${datasourceName}" not found` };
    }

    // Get value - try get() method first, fall back to getAll()
    let value: unknown;
    if (path && 'get' in ds && typeof ds.get === 'function') {
      value = await ds.get(path);
    } else if (path) {
      // Manual path resolution for non-inline datasources
      const data = await ds.getAll();
      value = data;
    } else {
      value = await ds.getAll();
    }

    if (value === undefined || value === null) {
      return { content: `⚠️ Value not found at path "${path}"` };
    }

    const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

    // Format output
    switch (format) {
      case 'code':
        return { content: `\`${strValue}\`` };
      case 'bold':
        return { content: ctx.markdown.bold(strValue) };
      case 'italic':
        return { content: ctx.markdown.italic(strValue) };
      default:
        return { content: strValue };
    }
  },
});

