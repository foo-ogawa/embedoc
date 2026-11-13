/**
 * CSV Datasource
 */

import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import type { Datasource, DatasourceConfig, QueryResult } from '../types/index.js';
import { filterRows } from './filter.js';

export class CsvDatasource implements Datasource {
  readonly type = 'csv';
  private data: QueryResult | null = null;
  private filePath: string;
  private encoding: BufferEncoding;

  constructor(config: DatasourceConfig) {
    if (!config.path) {
      throw new Error('CSV datasource requires "path" configuration');
    }

    this.filePath = config.path;
    this.encoding = (config.encoding as BufferEncoding) ?? 'utf-8';
  }

  private async loadData(): Promise<QueryResult> {
    if (this.data !== null) {
      return this.data;
    }

    const content = await readFile(this.filePath, { encoding: this.encoding });
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    this.data = records as QueryResult;
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

export function createCsvDatasource(config: DatasourceConfig): CsvDatasource {
  return new CsvDatasource(config);
}
