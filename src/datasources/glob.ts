/**
 * Glob Datasource
 * Get file list from filesystem
 */

import { stat } from 'node:fs/promises';
import { basename, dirname, extname } from 'node:path';
import { glob as globFn } from 'glob';
import type { Datasource, DatasourceConfig, QueryResult } from '../types/index.js';

interface FileInfo {
  path: string;
  name: string;
  basename: string;
  ext: string;
  dir: string;
  size: number;
  mtime: string;
}

export class GlobDatasource implements Datasource {
  readonly type = 'glob';
  private data: QueryResult | null = null;
  private pattern: string;

  constructor(config: DatasourceConfig) {
    if (!config.pattern) {
      throw new Error('Glob datasource requires "pattern" configuration');
    }

    this.pattern = config.pattern;
  }

  private async loadData(): Promise<QueryResult> {
    if (this.data !== null) {
      return this.data;
    }

    const files = await globFn(this.pattern, { nodir: true });
    const fileInfos: FileInfo[] = [];

    for (const filePath of files) {
      try {
        const stats = await stat(filePath);
        const ext = extname(filePath);

        fileInfos.push({
          path: filePath,
          name: basename(filePath),
          basename: basename(filePath, ext),
          ext: ext.slice(1), // Remove leading dot
          dir: dirname(filePath),
          size: stats.size,
          mtime: stats.mtime.toISOString(),
        });
      } catch {
        // Skip files that cannot be read
        continue;
      }
    }

    this.data = fileInfos as unknown as QueryResult;
    return this.data;
  }

  async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
    // Glob does not support SQL queries
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

export function createGlobDatasource(config: DatasourceConfig): GlobDatasource {
  return new GlobDatasource(config);
}
