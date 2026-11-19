import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateFromDatasource } from '../src/core/generator.js';
import type { Datasource, DatasourceConfig, EmbedocConfig } from '../src/types/index.js';

describe('generator output paths', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'embedoc-generator-'));
    await mkdir(join(dir, 'templates'), { recursive: true });
    await writeFile(join(dir, 'templates', 't.hbs'), '{{table_name}}\n');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const exists = (path: string) => access(path).then(() => true, () => false);

  async function generate(records: Record<string, unknown>[], outputPath: string) {
    const datasource: Datasource = {
      type: 'memory',
      query: async () => records,
      getAll: async () => records,
      close: async () => {},
    };
    const dsConfig: DatasourceConfig = { type: 'memory', generators: [{ output_path: outputPath, template: 't.hbs' }] };
    const config: EmbedocConfig = { version: '1.0', targets: [], templates_dir: join(dir, 'templates') };
    return generateFromDatasource('t', dsConfig, datasource, config);
  }

  it('writes no file outside the directory output_path names before its placeholders', async () => {
    const results = await generate(
      [{ table_name: '../../escaped' }, { table_name: 'users' }],
      `${dir}/out/tables/{table_name}.md`
    );
    expect(results.map((r) => r.success)).toEqual([false, true]);
    expect(results[0]?.error?.message).toContain('is outside');
    expect(await exists(join(dir, 'escaped.md'))).toBe(false);
    expect(await readFile(join(dir, 'out/tables/users.md'), 'utf-8')).toBe('users\n');
  });

  it('accepts values that stay inside it, including a directory and a name prefix', async () => {
    const results = await generate(
      [{ table_name: 'sub/inner' }, { table_name: 'x/../y' }],
      `${dir}/out/t_{table_name}.md`
    );
    expect(results.map((r) => r.success)).toEqual([true, true]);
    expect(await exists(join(dir, 'out/t_sub/inner.md'))).toBe(true);
    expect(await exists(join(dir, 'out/y.md'))).toBe(true);
  });
});
