/**
 * JSON Datasource
 */

import { readFile } from 'node:fs/promises';
import type { Datasource, DatasourceConfig, QueryResult } from '../types/index.js';
import { filterRows } from './filter.js';

export class JsonDatasource implements Datasource {
  readonly type = 'json';
  private data: QueryResult | null = null;
  private filePath: string;

  constructor(config: DatasourceConfig) {
    if (!config.path) {
      throw new Error('JSON datasource requires "path" configuration');
    }

    this.filePath = config.path;
  }

  private async loadData(): Promise<QueryResult> {
    if (this.data !== null) {
      return this.data;
    }

    const content = await readFile(this.filePath, { encoding: 'utf-8' });
    const parsed = JSON.parse(content) as unknown;

    // Use as-is if array, wrap in array if object
    if (Array.isArray(parsed)) {
      this.data = parsed as QueryResult;
    } else if (typeof parsed === 'object' && parsed !== null) {
      this.data = [parsed as Record<string, unknown>];
    } else {
      throw new Error('JSON file must contain an array or object');
    }

    return this.data;
  }

  async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
    return filterRows(await this.loadData(), sql, params);
  }

  async getAll(): Promise<QueryResult> {
    return this.loadData();
  }

  async close(): Promise<void> {
    this.data = null;
  }
}

export function createJsonDatasource(config: DatasourceConfig): JsonDatasource {
  return new JsonDatasource(config);
}
