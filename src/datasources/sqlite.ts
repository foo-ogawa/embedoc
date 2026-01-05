/**
 * SQLite Datasource
 */

import Database from 'better-sqlite3';
import type { Datasource, DatasourceConfig, QueryResult } from '../types/index.js';

export class SqliteDatasource implements Datasource {
  readonly type = 'sqlite';
  private db: Database.Database;
  private queryString?: string;

  constructor(config: DatasourceConfig) {
    if (!config.path) {
      throw new Error('SQLite datasource requires "path" configuration');
    }

    this.db = new Database(config.path, { readonly: true });
    this.queryString = config.query;
  }

  async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
    try {
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params);
      return rows as QueryResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`SQLite query failed: ${message}`);
    }
  }

  async getAll(): Promise<QueryResult> {
    if (!this.queryString) {
      throw new Error('No query defined for this datasource. Use query() method instead.');
    }
    return this.query(this.queryString);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export function createSqliteDatasource(config: DatasourceConfig): SqliteDatasource {
  return new SqliteDatasource(config);
}
