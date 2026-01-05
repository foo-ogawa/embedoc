/**
 * Datasource Factory
 */

import type { Datasource, DatasourceConfig, EmbedifyConfig } from '../types/index.js';
import { createSqliteDatasource } from './sqlite.js';
import { createCsvDatasource } from './csv.js';
import { createJsonDatasource } from './json.js';
import { createYamlDatasource } from './yaml.js';
import { createGlobDatasource } from './glob.js';

export { SqliteDatasource, createSqliteDatasource } from './sqlite.js';
export { CsvDatasource, createCsvDatasource } from './csv.js';
export { JsonDatasource, createJsonDatasource } from './json.js';
export { YamlDatasource, createYamlDatasource } from './yaml.js';
export { GlobDatasource, createGlobDatasource } from './glob.js';

/**
 * Create a datasource
 */
export function createDatasource(config: DatasourceConfig): Datasource {
  switch (config.type) {
    case 'sqlite':
      return createSqliteDatasource(config);
    case 'csv':
      return createCsvDatasource(config);
    case 'json':
      return createJsonDatasource(config);
    case 'yaml':
      return createYamlDatasource(config);
    case 'glob':
      return createGlobDatasource(config);
    default:
      throw new Error(`Unknown datasource type: ${(config as DatasourceConfig).type}`);
  }
}

/**
 * Initialize all datasources from config
 */
export function initializeDatasources(
  config: EmbedifyConfig
): Record<string, Datasource> {
  const datasources: Record<string, Datasource> = {};

  if (config.datasources) {
    for (const [name, dsConfig] of Object.entries(config.datasources)) {
      datasources[name] = createDatasource(dsConfig);
    }
  }

  return datasources;
}

/**
 * Close all datasources
 */
export async function closeDatasources(
  datasources: Record<string, Datasource>
): Promise<void> {
  for (const ds of Object.values(datasources)) {
    await ds.close();
  }
}
