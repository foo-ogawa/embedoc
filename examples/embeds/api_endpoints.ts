/**
 * api_endpoints Embed
 * Display API endpoints from CSV datasource as a table
 *
 * Usage: <!--@embedoc:api_endpoints-->
 *
 * Requires 'api_endpoints' datasource to be configured in embedoc.config.yaml
 */

import { defineEmbed } from 'embedoc';

export default defineEmbed({
  dependsOn: ['api_endpoints'],

  async render(ctx) {
    // Get all endpoints from CSV datasource
    const endpoints = await ctx.datasources['api_endpoints']!.getAll();

    if (endpoints.length === 0) {
      return { content: '⚠️ No API endpoints found' };
    }

    // Generate Markdown table
    const markdown = ctx.markdown.table(
      ['Endpoint', 'Method', 'Description', 'Auth Required'],
      endpoints.map((ep) => [
        `\`${ep['endpoint']}\``,
        ctx.markdown.bold(ep['method'] as string),
        ep['description'] as string,
        ep['auth_required'] === 'true' ? '✔' : '',
      ])
    );

    return { content: markdown };
  },
});

