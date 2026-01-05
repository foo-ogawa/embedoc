import { describe, it, expect } from 'vitest';
import {
  parseDotPath,
  resolveDotPath,
  setDotPath,
  getRootName,
  parseInlineContent,
  buildInlineDatasources,
  InlineDatasource,
} from '../src/core/inline-datasource.js';
import type { ParsedInlineData } from '../src/core/inline-datasource.js';

describe('parseDotPath', () => {
  it('should parse simple path', () => {
    expect(parseDotPath('name')).toEqual(['name']);
  });

  it('should parse dot-separated path', () => {
    expect(parseDotPath('author.name')).toEqual(['author', 'name']);
  });

  it('should parse deeply nested path', () => {
    expect(parseDotPath('project.author.contact.email')).toEqual([
      'project',
      'author',
      'contact',
      'email',
    ]);
  });

  it('should parse array index notation', () => {
    expect(parseDotPath('items[0]')).toEqual(['items', 0]);
  });

  it('should parse mixed dot and array access', () => {
    expect(parseDotPath('users[0].name')).toEqual(['users', 0, 'name']);
  });

  it('should parse multiple array indices', () => {
    expect(parseDotPath('matrix[0][1]')).toEqual(['matrix', 0, 1]);
  });

  it('should handle empty string', () => {
    expect(parseDotPath('')).toEqual([]);
  });
});

describe('resolveDotPath', () => {
  const testObj = {
    name: 'embedify',
    version: '1.0.0',
    author: {
      name: 'Jane',
      email: 'jane@example.com',
    },
    features: ['inline', 'watch', 'incremental'],
    nested: {
      deep: {
        value: 42,
      },
    },
  };

  it('should resolve simple property', () => {
    expect(resolveDotPath(testObj, 'name')).toBe('embedify');
  });

  it('should resolve nested property', () => {
    expect(resolveDotPath(testObj, 'author.name')).toBe('Jane');
  });

  it('should resolve deeply nested property', () => {
    expect(resolveDotPath(testObj, 'nested.deep.value')).toBe(42);
  });

  it('should resolve array index', () => {
    expect(resolveDotPath(testObj, 'features[0]')).toBe('inline');
    expect(resolveDotPath(testObj, 'features[1]')).toBe('watch');
  });

  it('should return undefined for missing path', () => {
    expect(resolveDotPath(testObj, 'missing')).toBeUndefined();
    expect(resolveDotPath(testObj, 'author.missing')).toBeUndefined();
  });

  it('should return undefined for deep missing path', () => {
    expect(resolveDotPath(testObj, 'missing.deep.path')).toBeUndefined();
  });

  it('should handle null/undefined input', () => {
    expect(resolveDotPath(null, 'any')).toBeUndefined();
    expect(resolveDotPath(undefined, 'any')).toBeUndefined();
  });
});

describe('setDotPath', () => {
  it('should set simple property', () => {
    const obj: Record<string, unknown> = {};
    setDotPath(obj, 'name', 'test');
    expect(obj.name).toBe('test');
  });

  it('should set nested property, creating intermediate objects', () => {
    const obj: Record<string, unknown> = {};
    setDotPath(obj, 'author.name', 'Jane');
    expect(obj).toEqual({ author: { name: 'Jane' } });
  });

  it('should set deeply nested property', () => {
    const obj: Record<string, unknown> = {};
    setDotPath(obj, 'a.b.c.d', 'value');
    expect(obj).toEqual({ a: { b: { c: { d: 'value' } } } });
  });

  it('should set array element', () => {
    const obj: Record<string, unknown> = { items: [] };
    setDotPath(obj, 'items[0]', 'first');
    expect((obj.items as string[])[0]).toBe('first');
  });

  it('should preserve existing properties', () => {
    const obj: Record<string, unknown> = { author: { email: 'jane@example.com' } };
    setDotPath(obj, 'author.name', 'Jane');
    expect(obj).toEqual({
      author: { email: 'jane@example.com', name: 'Jane' },
    });
  });
});

describe('getRootName', () => {
  it('should return name for simple path', () => {
    expect(getRootName('project')).toBe('project');
  });

  it('should return first segment for dotted path', () => {
    expect(getRootName('project.name')).toBe('project');
    expect(getRootName('project.author.name')).toBe('project');
  });
});

describe('parseInlineContent', () => {
  describe('code fence stripping', () => {
    it('should strip yaml code fences', () => {
      const content = `\`\`\`yaml
name: embedify
version: 1.0.0
\`\`\``;
      const result = parseInlineContent(content, 'yaml');
      expect(result).toEqual({ name: 'embedify', version: '1.0.0' });
    });

    it('should strip json code fences', () => {
      const content = `\`\`\`json
{"name": "test"}
\`\`\``;
      const result = parseInlineContent(content, 'json');
      expect(result).toEqual({ name: 'test' });
    });

    it('should strip plain code fences', () => {
      const content = `\`\`\`
name: embedify
\`\`\``;
      const result = parseInlineContent(content, 'yaml');
      expect(result).toEqual({ name: 'embedify' });
    });

    it('should handle content without code fences', () => {
      const content = `name: embedify`;
      const result = parseInlineContent(content, 'yaml');
      expect(result).toEqual({ name: 'embedify' });
    });

    it('should not strip code fences when disabled', () => {
      const content = `\`\`\`yaml
name: embedify
\`\`\``;
      // When stripCodeFences is false, the backticks remain and YAML parsing fails or returns unexpected result
      // Since the content starts with ```, YAML will parse it differently
      const result = parseInlineContent(content, 'text', { stripCodeFences: false });
      expect(result).toContain('```yaml');
    });

    it('should use custom strip patterns', () => {
      const content = `<!-- START -->
name: embedify
<!-- END -->`;
      const result = parseInlineContent(content, 'yaml', {
        stripCodeFences: true,
        stripPatterns: ['^<!--\\s*START\\s*-->\\s*\\n?', '\\n?<!--\\s*END\\s*-->\\s*$'],
      });
      expect(result).toEqual({ name: 'embedify' });
    });
  });

  describe('yaml format', () => {
    it('should parse YAML object', () => {
      const content = `
name: embedify
version: 1.0.0
`;
      const result = parseInlineContent(content, 'yaml');
      expect(result).toEqual({ name: 'embedify', version: '1.0.0' });
    });

    it('should parse YAML array', () => {
      const content = `
- first
- second
- third
`;
      const result = parseInlineContent(content, 'yaml');
      expect(result).toEqual(['first', 'second', 'third']);
    });

    it('should parse nested YAML', () => {
      const content = `
author:
  name: Jane
  email: jane@example.com
`;
      const result = parseInlineContent(content, 'yaml') as Record<string, unknown>;
      expect(result.author).toEqual({ name: 'Jane', email: 'jane@example.com' });
    });

    it('should handle empty YAML', () => {
      expect(parseInlineContent('', 'yaml')).toEqual({});
    });
  });

  describe('json format', () => {
    it('should parse JSON object', () => {
      const content = '{"name": "embedify", "version": "1.0.0"}';
      const result = parseInlineContent(content, 'json');
      expect(result).toEqual({ name: 'embedify', version: '1.0.0' });
    });

    it('should parse JSON array', () => {
      const content = '["first", "second", "third"]';
      const result = parseInlineContent(content, 'json');
      expect(result).toEqual(['first', 'second', 'third']);
    });

    it('should handle empty JSON', () => {
      expect(parseInlineContent('', 'json')).toEqual({});
    });
  });

  describe('csv format', () => {
    it('should parse CSV with headers', () => {
      const content = `name,age,role
Alice,25,admin
Bob,30,user`;
      const result = parseInlineContent(content, 'csv');
      expect(result).toEqual([
        { name: 'Alice', age: '25', role: 'admin' },
        { name: 'Bob', age: '30', role: 'user' },
      ]);
    });

    it('should handle empty CSV', () => {
      expect(parseInlineContent('', 'csv')).toEqual([]);
    });
  });

  describe('table format', () => {
    it('should parse Markdown table', () => {
      const content = `| Name | Age | Role |
|------|-----|------|
| Alice | 25 | admin |
| Bob | 30 | user |`;
      const result = parseInlineContent(content, 'table');
      expect(result).toEqual([
        { Name: 'Alice', Age: '25', Role: 'admin' },
        { Name: 'Bob', Age: '30', Role: 'user' },
      ]);
    });
  });

  describe('text format', () => {
    it('should return trimmed text', () => {
      const content = '  simple text value  ';
      const result = parseInlineContent(content, 'text');
      expect(result).toBe('simple text value');
    });
  });
});

describe('InlineDatasource', () => {
  it('should create datasource with object data', () => {
    const ds = new InlineDatasource(
      { name: 'test', version: '1.0' },
      'yaml',
      '/path/to/doc.md',
      10,
      15,
      50
    );

    expect(ds.type).toBe('inline');
    expect(ds.format).toBe('yaml');
    expect(ds.isObjectType()).toBe(true);
  });

  it('should create datasource with array data', () => {
    const ds = new InlineDatasource(
      [{ id: 1 }, { id: 2 }],
      'yaml',
      '/path/to/doc.md',
      10,
      15,
      50
    );

    expect(ds.isObjectType()).toBe(false);
  });

  it('should get value at dot-path', async () => {
    const ds = new InlineDatasource(
      { author: { name: 'Jane', email: 'jane@example.com' } },
      'yaml',
      '/path/to/doc.md',
      10,
      15,
      50
    );

    expect(await ds.get('author.name')).toBe('Jane');
    expect(await ds.get('author.email')).toBe('jane@example.com');
  });

  it('should return all data via getAll', async () => {
    const ds = new InlineDatasource(
      [{ id: 1 }, { id: 2 }],
      'yaml',
      '/path/to/doc.md',
      10,
      15,
      50
    );

    const all = await ds.getAll();
    expect(all).toHaveLength(2);
  });
});

describe('buildInlineDatasources', () => {
  it('should build datasource from single YAML block', () => {
    const parsed: ParsedInlineData[] = [
      {
        name: 'project',
        format: 'yaml',
        content: 'name: embedify\nversion: 1.0.0',
        startLine: 5,
        endLine: 8,
        byteSize: 30,
      },
    ];

    const datasources = buildInlineDatasources(parsed, '/doc.md');

    expect(datasources.has('project')).toBe(true);
    const ds = datasources.get('project')!;
    expect(ds.data).toEqual({ name: 'embedify', version: '1.0.0' });
  });

  it('should build datasource from dot-path definitions', () => {
    const parsed: ParsedInlineData[] = [
      {
        name: 'project.name',
        format: 'text',
        content: 'embedify',
        startLine: 5,
        endLine: 5,
        byteSize: 8,
      },
      {
        name: 'project.version',
        format: 'text',
        content: '1.0.0',
        startLine: 10,
        endLine: 10,
        byteSize: 5,
      },
      {
        name: 'project.author.name',
        format: 'text',
        content: 'Jane',
        startLine: 15,
        endLine: 15,
        byteSize: 4,
      },
    ];

    const datasources = buildInlineDatasources(parsed, '/doc.md');

    expect(datasources.has('project')).toBe(true);
    const ds = datasources.get('project')!;
    expect(ds.data).toEqual({
      name: 'embedify',
      version: '1.0.0',
      author: { name: 'Jane' },
    });
  });

  it('should merge dot-path definitions into YAML block', () => {
    const parsed: ParsedInlineData[] = [
      {
        name: 'config',
        format: 'yaml',
        content: 'api:\n  version: v1\n  timeout: 30',
        startLine: 5,
        endLine: 8,
        byteSize: 35,
      },
      {
        name: 'config.api.retries',
        format: 'text',
        content: '3',
        startLine: 15,
        endLine: 15,
        byteSize: 1,
      },
      {
        name: 'config.debug',
        format: 'text',
        content: 'true',
        startLine: 20,
        endLine: 20,
        byteSize: 4,
      },
    ];

    const datasources = buildInlineDatasources(parsed, '/doc.md');
    const ds = datasources.get('config')!;

    expect(ds.data).toEqual({
      api: { version: 'v1', timeout: 30, retries: '3' },
      debug: 'true',
    });
  });

  it('should throw error when size limit exceeded', () => {
    const parsed: ParsedInlineData[] = [
      {
        name: 'huge',
        format: 'yaml',
        content: 'x'.repeat(20000),
        startLine: 5,
        endLine: 100,
        byteSize: 20000,
      },
    ];

    expect(() => buildInlineDatasources(parsed, '/doc.md', { maxBytes: 10000 })).toThrow(
      /exceeds max size/
    );
  });

  it('should throw error for disallowed format', () => {
    const parsed: ParsedInlineData[] = [
      {
        name: 'data',
        format: 'csv',
        content: 'a,b\n1,2',
        startLine: 5,
        endLine: 7,
        byteSize: 10,
      },
    ];

    expect(() =>
      buildInlineDatasources(parsed, '/doc.md', { allowedFormats: ['yaml', 'json'] })
    ).toThrow(/disallowed format/);
  });
});

