/**
 * YAML Datasource
 */

import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';
import type { Datasource, DatasourceConfig, QueryResult } from '../types/index.js';

export class YamlDatasource implements Datasource {
  readonly type = 'yaml';
  private data: QueryResult | null = null;
  private filePath: string;

  constructor(config: DatasourceConfig) {
    if (!config.path) {
      throw new Error('YAML datasource requires "path" configuration');
    }

    this.filePath = config.path;
  }

  private async loadData(): Promise<QueryResult> {
    if (this.data !== null) {
      return this.data;
    }

    const content = await readFile(this.filePath, { encoding: 'utf-8' });
    const parsed = yaml.load(content);

    // Use as-is if array, wrap in array if object
    if (Array.isArray(parsed)) {
      this.data = parsed as QueryResult;
    } else if (typeof parsed === 'object' && parsed !== null) {
      this.data = [parsed as Record<string, unknown>];
    } else {
      throw new Error('YAML file must contain an array or object');
    }

    return this.data;
  }

  async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
    // YAML does not support SQL queries
    // Simple filtering only
    const data = await this.loadData();

    // Only supports simple WHERE column = value
    const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
    if (whereMatch && params.length > 0) {
      const column = whereMatch[1];
      const value = params[0];
      return data.filter((row) => {
        const rowValue = row[column ?? ''];
        return rowValue === value || String(rowValue) === String(value);
      });
    }

    return data;
  }

  async getAll(): Promise<QueryResult> {
    return this.loadData();
  }

  async close(): Promise<void> {
    this.data = null;
  }
}

export function createYamlDatasource(config: DatasourceConfig): YamlDatasource {
  return new YamlDatasource(config);
}
