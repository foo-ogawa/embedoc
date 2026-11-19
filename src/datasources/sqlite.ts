/**
 * SQLite Datasource
 */

import { createRequire as createModuleRequire } from 'node:module';
import type BetterSqlite3 from 'better-sqlite3';
import type { Datasource, DatasourceConfig, QueryResult } from '../types/index.js';

const SUPPORTED_BETTER_SQLITE3 = '^11.7.0';

/**
 * Load the `better-sqlite3` package (an optional peer dependency).
 */
function loadBetterSqlite3(): typeof BetterSqlite3 {
  try {
    return createModuleRequire(import.meta.url)('better-sqlite3') as typeof BetterSqlite3;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `The "sqlite" datasource needs the "better-sqlite3" package (${SUPPORTED_BETTER_SQLITE3}). ` +
        `Install it in your project (npm install better-sqlite3). Cause: ${message}`,
      { cause: error }
    );
  }
}

export class SqliteDatasource implements Datasource {
  readonly type = 'sqlite';
  private db: BetterSqlite3.Database;
  private queryString?: string;

  constructor(config: DatasourceConfig) {
    if (!config.path) {
      throw new Error('SQLite datasource requires "path" configuration');
    }

    const Database = loadBetterSqlite3();
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
      throw new Error(`SQLite query failed: ${message}`, { cause: error });
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
