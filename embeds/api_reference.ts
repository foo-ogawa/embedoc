/**
 * api_reference Embed
 * Write the API reference of a `typescript` datasource on one page.
 *
 * Usage: <!--@embedoc:api_reference datasource="embed_api"-->
 *
 * Parameters:
 *   - datasource: Name of a `typescript` datasource (required)
 */

import { defineEmbed, renderApiIndex } from '../dist/index.js';

export default defineEmbed({
  dependsOn: ['embed_api'],
  async render(ctx) {
    const name = ctx.params['datasource'];
    const ds = name ? ctx.datasources[name] : undefined;
    if (!ds) {
      throw new Error(`api_reference: unknown datasource "${name ?? ''}"`);
    }
    return { content: renderApiIndex(await ds.getAll()) };
  },
});
