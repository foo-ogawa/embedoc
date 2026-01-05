/**
 * Datasource Tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import {
  CsvDatasource,
  JsonDatasource,
  YamlDatasource,
  GlobDatasource,
  SqliteDatasource,
  createDatasource,
  initializeDatasources,
  closeDatasources,
} from '../dist/index.js';

describe('SqliteDatasource', () => {
  let tempDir: string;
  let dbPath: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'embedify-test-'));
    dbPath = join(tempDir, 'test.db');

    // Create test database
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT
      );
      INSERT INTO users (id, name, email) VALUES (1, 'Alice', 'alice@example.com');
      INSERT INTO users (id, name, email) VALUES (2, 'Bob', 'bob@example.com');
      INSERT INTO users (id, name, email) VALUES (3, 'Charlie', NULL);
    `);
    db.close();
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('should query data from SQLite database', async () => {
    const ds = new SqliteDatasource({ type: 'sqlite', path: dbPath });
    
    const result = await ds.query('SELECT * FROM users ORDER BY id');
    
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ id: 1, name: 'Alice', email: 'alice@example.com' });
    expect(result[1]).toEqual({ id: 2, name: 'Bob', email: 'bob@example.com' });
    expect(result[2]).toEqual({ id: 3, name: 'Charlie', email: null });

    await ds.close();
  });

  it('should query with parameters', async () => {
    const ds = new SqliteDatasource({ type: 'sqlite', path: dbPath });
    
    const result = await ds.query('SELECT * FROM users WHERE name = ?', ['Bob']);
    
    expect(result).toHaveLength(1);
    expect(result[0]?.['name']).toBe('Bob');

    await ds.close();
  });

  it('should get all data using default query', async () => {
    const ds = new SqliteDatasource({ 
      type: 'sqlite', 
      path: dbPath,
      query: 'SELECT * FROM users WHERE id <= 2'
    });
    
    const result = await ds.getAll();
    
    expect(result).toHaveLength(2);

    await ds.close();
  });

  it('should throw error if path not provided', () => {
    expect(() => new SqliteDatasource({ type: 'sqlite' }))
      .toThrow('SQLite datasource requires "path" configuration');
  });

  it('should throw error if getAll called without query', async () => {
    const ds = new SqliteDatasource({ type: 'sqlite', path: dbPath });
    
    await expect(ds.getAll()).rejects.toThrow('No query defined');

    await ds.close();
  });
});

describe('CsvDatasource', () => {
  let tempDir: string;
  let csvPath: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'embedify-test-'));
    csvPath = join(tempDir, 'test.csv');
    
    await writeFile(csvPath, `name,age,city
Alice,30,Tokyo
Bob,25,Osaka
Charlie,35,Kyoto`);
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('should read CSV file', async () => {
    const ds = new CsvDatasource({ type: 'csv', path: csvPath });
    
    const result = await ds.getAll();
    
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ name: 'Alice', age: '30', city: 'Tokyo' });
    expect(result[1]).toEqual({ name: 'Bob', age: '25', city: 'Osaka' });
    expect(result[2]).toEqual({ name: 'Charlie', age: '35', city: 'Kyoto' });

    await ds.close();
  });

  it('should filter with simple WHERE clause', async () => {
    const ds = new CsvDatasource({ type: 'csv', path: csvPath });
    
    const result = await ds.query('SELECT * WHERE name = ?', ['Bob']);
    
    expect(result).toHaveLength(1);
    expect(result[0]?.['name']).toBe('Bob');

    await ds.close();
  });

  it('should return all data without WHERE clause', async () => {
    const ds = new CsvDatasource({ type: 'csv', path: csvPath });
    
    const result = await ds.query('SELECT *');
    
    expect(result).toHaveLength(3);

    await ds.close();
  });

  it('should throw error if path not provided', () => {
    expect(() => new CsvDatasource({ type: 'csv' }))
      .toThrow('CSV datasource requires "path" configuration');
  });
});

describe('JsonDatasource', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'embedify-test-'));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('should read JSON array file', async () => {
    const jsonPath = join(tempDir, 'array.json');
    await writeFile(jsonPath, JSON.stringify([
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' }
    ]));

    const ds = new JsonDatasource({ type: 'json', path: jsonPath });
    const result = await ds.getAll();
    
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 1, name: 'Item 1' });

    await ds.close();
  });

  it('should wrap single object in array', async () => {
    const jsonPath = join(tempDir, 'object.json');
    await writeFile(jsonPath, JSON.stringify({ id: 1, name: 'Single Item' }));

    const ds = new JsonDatasource({ type: 'json', path: jsonPath });
    const result = await ds.getAll();
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 1, name: 'Single Item' });

    await ds.close();
  });

  it('should filter with simple WHERE clause', async () => {
    const jsonPath = join(tempDir, 'filter.json');
    await writeFile(jsonPath, JSON.stringify([
      { id: 1, status: 'active' },
      { id: 2, status: 'inactive' },
      { id: 3, status: 'active' }
    ]));

    const ds = new JsonDatasource({ type: 'json', path: jsonPath });
    const result = await ds.query('SELECT * WHERE status = ?', ['active']);
    
    expect(result).toHaveLength(2);

    await ds.close();
  });

  it('should throw error if path not provided', () => {
    expect(() => new JsonDatasource({ type: 'json' }))
      .toThrow('JSON datasource requires "path" configuration');
  });
});

describe('YamlDatasource', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'embedify-test-'));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('should read YAML array file', async () => {
    const yamlPath = join(tempDir, 'array.yaml');
    await writeFile(yamlPath, `
- id: 1
  name: Item 1
- id: 2
  name: Item 2
`);

    const ds = new YamlDatasource({ type: 'yaml', path: yamlPath });
    const result = await ds.getAll();
    
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 1, name: 'Item 1' });

    await ds.close();
  });

  it('should wrap single object in array', async () => {
    const yamlPath = join(tempDir, 'object.yaml');
    await writeFile(yamlPath, `
id: 1
name: Single Item
`);

    const ds = new YamlDatasource({ type: 'yaml', path: yamlPath });
    const result = await ds.getAll();
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 1, name: 'Single Item' });

    await ds.close();
  });

  it('should filter with simple WHERE clause', async () => {
    const yamlPath = join(tempDir, 'filter.yaml');
    await writeFile(yamlPath, `
- id: 1
  status: active
- id: 2
  status: inactive
- id: 3
  status: active
`);

    const ds = new YamlDatasource({ type: 'yaml', path: yamlPath });
    const result = await ds.query('SELECT * WHERE status = ?', ['active']);
    
    expect(result).toHaveLength(2);

    await ds.close();
  });

  it('should throw error if path not provided', () => {
    expect(() => new YamlDatasource({ type: 'yaml' }))
      .toThrow('YAML datasource requires "path" configuration');
  });
});

describe('GlobDatasource', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'embedify-test-'));
    
    // Create test files
    await mkdir(join(tempDir, 'docs'));
    await writeFile(join(tempDir, 'docs', 'readme.md'), '# README');
    await writeFile(join(tempDir, 'docs', 'guide.md'), '# Guide');
    await writeFile(join(tempDir, 'config.json'), '{}');
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('should list files matching pattern', async () => {
    const ds = new GlobDatasource({ 
      type: 'glob', 
      pattern: join(tempDir, 'docs', '*.md')
    });
    
    const result = await ds.getAll();
    
    expect(result).toHaveLength(2);
    
    const names = result.map(r => r['name']);
    expect(names).toContain('readme.md');
    expect(names).toContain('guide.md');

    await ds.close();
  });

  it('should include file metadata', async () => {
    const ds = new GlobDatasource({ 
      type: 'glob', 
      pattern: join(tempDir, 'config.json')
    });
    
    const result = await ds.getAll();
    
    expect(result).toHaveLength(1);
    expect(result[0]?.['name']).toBe('config.json');
    expect(result[0]?.['basename']).toBe('config');
    expect(result[0]?.['ext']).toBe('json');
    expect(result[0]?.['size']).toBe(2); // '{}'
    expect(result[0]?.['mtime']).toBeDefined();

    await ds.close();
  });

  it('should filter with simple WHERE clause', async () => {
    const ds = new GlobDatasource({ 
      type: 'glob', 
      pattern: join(tempDir, '**', '*')
    });
    
    const result = await ds.query('SELECT * WHERE ext = ?', ['md']);
    
    expect(result).toHaveLength(2);

    await ds.close();
  });

  it('should throw error if pattern not provided', () => {
    expect(() => new GlobDatasource({ type: 'glob' }))
      .toThrow('Glob datasource requires "pattern" configuration');
  });
});

describe('createDatasource factory', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'embedify-test-'));
    await writeFile(join(tempDir, 'test.json'), '[]');
    await writeFile(join(tempDir, 'test.yaml'), '[]');
    await writeFile(join(tempDir, 'test.csv'), 'name\n');
    
    const db = new Database(join(tempDir, 'test.db'));
    db.exec('CREATE TABLE t (id INTEGER)');
    db.close();
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('should create SQLite datasource', () => {
    const ds = createDatasource({ type: 'sqlite', path: join(tempDir, 'test.db') });
    expect(ds.type).toBe('sqlite');
    ds.close();
  });

  it('should create CSV datasource', () => {
    const ds = createDatasource({ type: 'csv', path: join(tempDir, 'test.csv') });
    expect(ds.type).toBe('csv');
    ds.close();
  });

  it('should create JSON datasource', () => {
    const ds = createDatasource({ type: 'json', path: join(tempDir, 'test.json') });
    expect(ds.type).toBe('json');
    ds.close();
  });

  it('should create YAML datasource', () => {
    const ds = createDatasource({ type: 'yaml', path: join(tempDir, 'test.yaml') });
    expect(ds.type).toBe('yaml');
    ds.close();
  });

  it('should create Glob datasource', () => {
    const ds = createDatasource({ type: 'glob', pattern: join(tempDir, '*') });
    expect(ds.type).toBe('glob');
    ds.close();
  });

  it('should throw error for unknown type', () => {
    expect(() => createDatasource({ type: 'unknown' as any }))
      .toThrow('Unknown datasource type');
  });
});

describe('initializeDatasources / closeDatasources', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'embedify-test-'));
    await writeFile(join(tempDir, 'data.json'), '[]');
    await writeFile(join(tempDir, 'data.csv'), 'col\n');
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('should initialize multiple datasources from config', () => {
    const config = {
      version: '1.0',
      targets: [],
      datasources: {
        json_ds: { type: 'json' as const, path: join(tempDir, 'data.json') },
        csv_ds: { type: 'csv' as const, path: join(tempDir, 'data.csv') },
      }
    };

    const datasources = initializeDatasources(config);
    
    expect(Object.keys(datasources)).toHaveLength(2);
    expect(datasources['json_ds']?.type).toBe('json');
    expect(datasources['csv_ds']?.type).toBe('csv');

    closeDatasources(datasources);
  });

  it('should handle empty datasources config', () => {
    const config = {
      version: '1.0',
      targets: [],
    };

    const datasources = initializeDatasources(config);
    
    expect(Object.keys(datasources)).toHaveLength(0);
  });
});

