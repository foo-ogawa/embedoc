/**
 * TypeScript API datasource and its Markdown rendering,
 * checked against the fixture project in test/fixtures/ts-api.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatasource, TypeScriptDatasource } from '../src/datasources/index.js';
import { parseDocComment } from '../src/datasources/typescript.js';
import { renderApiIndex, renderApiPage } from '../src/helpers/api-markdown.js';
import { generateFromDatasource } from '../src/core/generator.js';
import type { ApiSymbol, QueryResult, EmbedocConfig, DatasourceConfig } from '../src/types/index.js';

const ENTRY = 'test/fixtures/ts-api/src/index.ts';
const LINK = 'https://example.com/r/blob/{gitRevision}/{path}#L{line}';
const SLOW = 180_000; // one TypeScript program per datasource

function config(extra: Partial<DatasourceConfig> = {}): DatasourceConfig {
  return { type: 'typescript', entry_points: [ENTRY], source_link_template: LINK, git_revision: 'main', ...extra };
}

let rows: QueryResult;
const symbol = (name: string) => rows.find((r) => r['name'] === name) as unknown as ApiSymbol;

beforeAll(async () => {
  const ds = await createDatasource(config({ pages: ['class', 'interface'] }));
  rows = await ds.getAll();
}, SLOW);

describe('TypeScript datasource', () => {
  it('returns the exported symbols in source order, without @internal ones', () => {
    expect(rows.map((r) => `${r['kind']}:${r['name']}`)).toEqual([
      'reference:LegacyStore',
      'interface:StoreOptions',
      'class:Store',
      'type:Id',
      'function:greet',
      'function:add',
      'variable:makeId',
      'variable:settings',
      'enum:Color',
      'class:Worker',
      'function:bound',
    ]);
  });

  it('reads categories, including one written after the summary on the same line', () => {
    expect(symbol('Store').category).toBe('Core');
    expect(symbol('add').category).toBe('Math');
    expect(symbol('greet').category).toBeNull();
  });

  it('builds source links from the template and git_revision', () => {
    expect(symbol('Store').source).toEqual({
      file: 'store.ts',
      path: 'test/fixtures/ts-api/src/store.ts',
      line: 37,
      url: 'https://example.com/r/blob/main/test/fixtures/ts-api/src/store.ts#L37',
    });
  });

  it('leaves out private and @internal members and keeps protected ones', () => {
    const store = symbol('Store');
    expect(store.members.map((m) => `${m.kind}:${m.name}`)).toEqual([
      'property:count',
      'property:options',
      'constructor:constructor',
      'property:label',
      'accessor:size',
      'method:get',
      'method:set',
      'method:create',
    ]);
    expect(store.members.find((m) => m.name === 'options')).toMatchObject({ protected: true, readonly: true });
    // A constructor parameter property is a property, described by the constructor's @param.
    expect(store.members.find((m) => m.name === 'label')).toMatchObject({
      readonly: true,
      optional: true,
      type: 'string',
      summary: 'Display label',
    });
    expect(symbol('StoreOptions').members.map((m) => m.name)).toEqual(['name', 'limit', 'mode']);
  });

  it('keeps overload signatures and drops the implementation', () => {
    const get = symbol('Store').members.find((m) => m.name === 'get')!;
    expect(get.signatures.map((s) => s.code)).toEqual([
      'get(key: string): T | undefined;',
      'get(key: string, fallback: T): T;',
    ]);
    expect(get.signatures[1]!.parameters.map((p) => [p.name, p.description])).toEqual([
      ['key', 'The key'],
      ['fallback', 'Returned when the key is missing'],
    ]);
  });

  it('treats a const initialized with an arrow function as a function, and a typed one as a variable', () => {
    expect(symbol('add').signatures[0]).toMatchObject({
      code: 'function add(a: number, b?: number): number;',
      summary: 'Add two numbers.',
    });
    expect(symbol('makeId').code).toBe('const makeId: (raw: string) => Id;');
  });

  it('expands the object literal of a variable', () => {
    expect(symbol('settings').members.map((m) => [m.name, m.type, m.summary])).toEqual([
      ['verbose', 'boolean', 'Whether verbose output is on.'],
      ['width', 'number', 'Output width.'],
    ]);
  });

  it('keeps @decorator lines and indentation of an example as code', () => {
    const example = symbol('Store').tags.find((t) => t.tag === 'example')!;
    expect(example.text).toBe(
      [
        'Basic use',
        '```ts',
        '@decorated()',
        'class Model {}',
        "const store = new Store<string>({ name: 'a' });",
        "  store.set('k', 'v');",
        '```',
      ].join('\n')
    );
  });

  it('resolves {@link} targets and type names that are exported symbols', () => {
    expect(symbol('Store').links).toEqual([
      { target: 'Store.get', name: 'Store', kind: 'class', kindDir: 'classes', page: 'classes/Store.md', member: 'get' },
      { target: 'greet', name: 'greet', kind: 'function', kindDir: 'functions', page: null, member: null },
      { target: 'StoreOptions', name: 'StoreOptions', kind: 'interface', kindDir: 'interfaces', page: 'interfaces/StoreOptions.md', member: null },
      { target: 'Store', name: 'Store', kind: 'class', kindDir: 'classes', page: 'classes/Store.md', member: null },
    ]);
  });

  it('gives the symbols of the kinds in `pages` a page, and no others', () => {
    expect(rows.filter((r) => r['hasPage']).map((r) => [r['name'], r['page']])).toEqual([
      ['StoreOptions', 'interfaces/StoreOptions.md'],
      ['Store', 'classes/Store.md'],
      ['Worker', 'classes/Worker.md'],
    ]);
    expect(symbol('greet').page).toBeNull();
  });

  it('keeps a `this` parameter', () => {
    expect(symbol('bound').signatures[0]).toMatchObject({
      code: 'function bound(this: Store<string>, key: string): string | undefined;',
    });
    expect(symbol('bound').signatures[0]!.parameters.map((p) => [p.name, p.type])).toEqual([
      ['this', 'Store<string>'],
      ['key', 'string'],
    ]);
  });

  it('marks an abstract class and its abstract members', () => {
    expect(symbol('Worker').abstract).toBe(true);
    expect(symbol('Store').abstract).toBe(false);
    expect(symbol('Worker').members.map((m) => [m.name, m.abstract])).toEqual([
      ['id', true],
      ['run', true],
    ]);
  });

  it('records a second exported name as a reference', () => {
    expect(symbol('LegacyStore')).toMatchObject({ kind: 'reference', referenceOf: 'Store', category: null });
  });

  it('filters with WHERE column = ?', async () => {
    const ds = new TypeScriptDatasource(config());
    const functions = await ds.query('SELECT * WHERE kind = ?', ['function']);
    expect(functions.map((r) => r['name'])).toEqual(['greet', 'add', 'bound']);
  }, SLOW);

  it('sorts alphabetically when asked', async () => {
    const ds = await createDatasource(config({ sort: 'alphabetical' }));
    const names = (await ds.getAll()).map((r) => r['name']);
    expect(names).toEqual([
      'add', 'bound', 'Color', 'greet', 'Id', 'LegacyStore', 'makeId', 'settings', 'Store', 'StoreOptions', 'Worker',
    ]);
  }, SLOW);

  it('rejects a configuration it cannot honour', async () => {
    await expect(createDatasource({ type: 'typescript' })).rejects.toThrow('"entry_points"');
    await expect(createDatasource(config({ git_revision: undefined }))).rejects.toThrow('git_revision');
    await expect(createDatasource(config({ sort: 'size' }))).rejects.toThrow('"sort"');
    await expect(createDatasource(config({ pages: ['klass'] }))).rejects.toThrow('"pages"');
  });
});

describe('parseDocComment', () => {
  it('splits summary and block tags, and leaves inline code and fenced code alone', () => {
    const doc = parseDocComment(
      [
        '/**',
        ' * Uses `@column.text()` on a field. @category Decorators',
        ' * @param {string} [name=x] - The name',
        ' * @returns {number} A count',
        ' * @example',
        ' * ```ts',
        ' * @column.text() name?: string;',
        ' * ```',
        ' */',
      ].join('\n')
    );
    expect(doc.summary).toBe('Uses `@column.text()` on a field.');
    expect(doc.parameters.get('name')).toBe('The name');
    expect(doc.returns).toBe('A count');
    expect(doc.tags).toEqual([
      { tag: 'category', text: 'Decorators' },
      { tag: 'example', text: '```ts\n@column.text() name?: string;\n```' },
    ]);
  });
});

describe('API Markdown rendering', () => {
  const options = { categoryOrder: ['Core', '*'] };

  it('renders the index grouped by kind and category, linking symbols that have their own page', () => {
    const index = renderApiIndex(rows, options);
    expect(index.split('\n').filter((l) => l.startsWith('#') || l.startsWith('- '))).toEqual([
      '## Enumerations',
      '### Color',
      '#### Enumeration Members',
      '## Classes',
      '### Core',
      '- [Store](classes/Store.md)',
      '### Other',
      '- [Worker](classes/Worker.md)',
      '## Interfaces',
      '### Core',
      '- [StoreOptions](interfaces/StoreOptions.md)',
      '## Type Aliases',
      '### Id',
      '## Variables',
      '### makeId',
      '### settings',
      '#### Properties',
      '## Functions',
      '### Math',
      '#### add()',
      '##### Parameters',
      '##### Returns',
      '### Other',
      '#### greet()',
      '##### Parameters',
      '##### Returns',
      '#### bound()',
      '##### Parameters',
      '##### Returns',
      '## References',
      '### LegacyStore',
    ]);
    expect(index).toContain('Renames and re-exports [Store](classes/Store.md)');
    expect(index).toContain(
      '| <a id="red"></a> `Red` | `"red"` | Red | [util.ts:31](https://example.com/r/blob/main/test/fixtures/ts-api/src/util.ts#L31) |'
    );
  });

  it('writes a function documentation once, with deprecation and parameters', () => {
    const index = renderApiIndex(rows, options);
    const greet = index.slice(index.indexOf('#### greet()'), index.indexOf('***', index.indexOf('#### greet()')));
    expect(greet).toBe(
      [
        '#### greet()',
        '```ts\nfunction greet(name: string): string;\n```',
        'Defined in: [util.ts:10](https://example.com/r/blob/main/test/fixtures/ts-api/src/util.ts#L10)',
        '> **Deprecated** Use a template string.',
        'Say hello.',
        '##### Parameters',
        '| Parameter | Type | Description |\n| ------ | ------ | ------ |\n| `name` | `string` | Who to greet |',
        '##### Returns',
        '`string`',
        'The greeting',
        '',
      ].join('\n\n')
    );
  });

  it('renders a class page with members, overloads and links', () => {
    const page = renderApiPage(symbol('Store') as unknown as Record<string, unknown>, options);
    expect(page.startsWith('[API](../README.md) / Store\n\n# Class: Store\\<T\\>\n\n')).toBe(true);
    expect(page).toContain('### Basic use\n\n```ts\n@decorated()\nclass Model {}');
    expect(page).toContain('```ts\nnew Store(options: StoreOptions, label?: string): Store<T>;\n```');
    expect(page).toContain(
      '| <a id="options"></a> `options` (readonly protected) | [`StoreOptions`](../interfaces/StoreOptions.md) |'
    );
    expect(page).toContain(
      'Write a value. See [`Store.get`](../classes/Store.md#get) and [`greet`](../README.md#greet).'
    );
    // A static method's heading is its plain name, so links to `#create` work.
    expect(page).toContain(
      '### create()\n\n```ts\nstatic create<V>(name: string): Store<V>;\n```'
    );
    expect(page).toContain('| `V` | Type of the values |');
    expect(page).not.toContain('reset()');
    expect(page).not.toContain('<a id="items">');
  });

  it('links within the index when no symbol has a page', { timeout: SLOW }, async () => {
    const index = renderApiIndex(await (await createDatasource(config())).getAll());
    expect(index).toContain('Options of a [`Store`](#store).');
    expect(index).toContain('Renames and re-exports [Store](#store)');
  });

  it('gives the same output for the same input', async () => {
    const again = await (await createDatasource(config({ pages: ['class', 'interface'] }))).getAll();
    expect(renderApiIndex(again, options)).toBe(renderApiIndex(rows, options));
  }, SLOW);

  it('writes an @example of a member into its table row', () => {
    const page = renderApiPage(symbol('StoreOptions') as unknown as Record<string, unknown>, options);
    expect(page).toContain("| Write mode.<br><br>**Example** `new Store({ name: 'a', mode: 'safe' });` |");
  });

  it('escapes | inside code spans of table cells, so every row has the columns of its header', () => {
    const pages = rows.filter((r) => r['hasPage']).map((r) => renderApiPage(r, options));
    const all = [...pages, renderApiIndex(rows, options)].join('\n');
    expect(all).toContain("`'fast' \\| 'safe'`");
    const columns = (line: string) => line.replace(/\\\|/g, '').split('|').length;
    let header = 0;
    const broken: string[] = [];
    for (const line of all.split('\n')) {
      if (!line.startsWith('|')) { header = 0; continue; }
      if (header === 0) header = columns(line);
      else if (columns(line) !== header) broken.push(line);
    }
    expect(broken).toEqual([]);
  });

  it('shows a default value even when no parameter has a description', () => {
    const index = renderApiIndex(rows, options);
    expect(index).toContain('| `b?` | `number` | **Default** `1` |');
  });

  it('shows the `this` parameter', () => {
    const index = renderApiIndex(rows, options);
    expect(index).toContain('| `this` | [`Store`](classes/Store.md)`<string>` |');
  });

  it('marks abstract classes and members, and links types to their pages', () => {
    const worker = renderApiPage(symbol('Worker') as unknown as Record<string, unknown>, options);
    expect(worker).toContain('# Abstract Class: Worker');
    expect(worker).toContain('`id` (abstract readonly)');
    expect(worker).toContain('abstract run(): Promise<void>;');
    const store = renderApiPage(symbol('Store') as unknown as Record<string, unknown>, options);
    expect(store).toContain('| `options` | [`StoreOptions`](../interfaces/StoreOptions.md) | Store options |');
  });
});

describe('api_page generator helper', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'embedoc-api-'));
    await mkdir(join(dir, 'templates'));
    await writeFile(
      join(dir, 'templates', 'api.hbs'),
      '{{api_page this index_file="globals.md"}}'
    );
  });

  afterAll(async () => {
    await rm(dir, { recursive: true });
  });

  it('writes a page for each record that has one, and prunes pages of symbols no longer exported', { timeout: SLOW }, async () => {
    const out = join(dir, 'out');
    await mkdir(join(out, 'classes'), { recursive: true });
    await writeFile(join(out, 'classes', 'Gone.md'), 'stale page of a removed export');
    await writeFile(join(dir, 'README.md'), 'not matched by output_path');
    const dsConfig = config({
      pages: ['class', 'interface'],
      generators: [
        {
          output_path: join(out, '{kindDir}', '{name}.md'),
          template: 'api.hbs',
          overwrite: true,
          where: { hasPage: 'true' },
          prune: true,
        },
      ],
    });
    const embedocConfig: EmbedocConfig = { version: '1.0', targets: [], templates_dir: join(dir, 'templates') };
    const ds = await createDatasource(dsConfig);
    const results = await generateFromDatasource('api', dsConfig, ds, embedocConfig);
    expect(results.map((r) => [r.success, r.removed ?? false, r.filePath])).toEqual([
      [true, false, join(out, 'interfaces', 'StoreOptions.md')],
      [true, false, join(out, 'classes', 'Store.md')],
      [true, false, join(out, 'classes', 'Worker.md')],
      [true, true, join(out, 'classes', 'Gone.md')],
    ]);
    await expect(readFile(join(out, 'classes', 'Gone.md'), 'utf-8')).rejects.toThrow();
    expect(await readFile(join(dir, 'README.md'), 'utf-8')).toBe('not matched by output_path');
    const page = await readFile(join(out, 'classes', 'Store.md'), 'utf-8');
    expect(page).toBe(renderApiPage(symbol('Store') as unknown as Record<string, unknown>, { indexFile: 'globals.md' }));
  });
});
