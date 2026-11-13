/**
 * Simple row filtering shared by the file-based datasources
 * (CSV, JSON, YAML, glob, TypeScript), which do not support SQL.
 */

import type { QueryResult } from '../types/index.js';

/**
 * Apply the only query form the file-based datasources understand:
 * `... WHERE column = ?` with the value taken from `params[0]`.
 * Values are compared as strings. Any other query returns every row.
 */
export function filterRows(data: QueryResult, sql: string, params: unknown[]): QueryResult {
  const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
  if (whereMatch && params.length > 0) {
    const column = whereMatch[1] ?? '';
    const value = String(params[0]);
    return data.filter((row) => String(row[column]) === value);
  }
  return data;
}
