/**
 * Embed Registration
 * Export all embeds here
 */

import tableColumns from './table_columns.ts';
import tableRelations from './table_relations.ts';
import tableIndex from './table_index.ts';
import codeSnippet from './code_snippet.ts';
import apiEndpoints from './api_endpoints.ts';
import openapiEndpoints from './openapi_endpoints.ts';
import inlineValue from './inline_value.ts';
import featureTable from './feature_table.ts';

export const embeds = {
  table_columns: tableColumns,
  table_relations: tableRelations,
  table_index: tableIndex,
  code_snippet: codeSnippet,
  api_endpoints: apiEndpoints,
  openapi_endpoints: openapiEndpoints,
  inline_value: inlineValue,
  feature_table: featureTable,
};
