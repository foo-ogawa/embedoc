import { describe, it, expect } from 'vitest';
import {
  parseAttributes,
  parseMarkers,
  parseFrontmatter,
  resolveVariables,
  getCommentStyle,
  guessCommentStyle,
  DEFAULT_COMMENT_STYLES,
} from '../src/core/parser.js';

describe('parseAttributes', () => {
  it('should parse single attribute with double quotes', () => {
    const result = parseAttributes('id="users"');
    expect(result).toEqual({ id: 'users' });
  });

  it('should parse single attribute with single quotes', () => {
    const result = parseAttributes("id='users'");
    expect(result).toEqual({ id: 'users' });
  });

  it('should parse multiple attributes', () => {
    const result = parseAttributes('id="users" schema="public" limit="10"');
    expect(result).toEqual({ id: 'users', schema: 'public', limit: '10' });
  });

  it('should return empty object for empty string', () => {
    const result = parseAttributes('');
    expect(result).toEqual({});
  });

  it('should handle attributes with spaces', () => {
    const result = parseAttributes('   id="users"   schema="public"   ');
    expect(result).toEqual({ id: 'users', schema: 'public' });
  });
});

describe('parseMarkers', () => {
  it('should parse HTML-style markers', () => {
    const content = `
# Title

<!--@embedoc:table_columns id="users"-->
| Column | Type |
| --- | --- |
| id | integer |
<!--@embedoc:end-->

Other content
`;
    const markers = parseMarkers(content, DEFAULT_COMMENT_STYLES.html);
    
    expect(markers).toHaveLength(1);
    expect(markers[0].templateName).toBe('table_columns');
    expect(markers[0].params).toEqual({ id: 'users' });
    expect(markers[0].existingContent).toContain('| Column | Type |');
  });

  it('should parse block comment style markers', () => {
    const content = `
const x = 1;
/*@embedoc:type_definition id="User"*/
export interface User {
  id: number;
}
/*@embedoc:end*/
const y = 2;
`;
    const markers = parseMarkers(content, DEFAULT_COMMENT_STYLES.block);
    
    expect(markers).toHaveLength(1);
    expect(markers[0].templateName).toBe('type_definition');
    expect(markers[0].params).toEqual({ id: 'User' });
  });

  it('should parse line comment style markers', () => {
    const content = `
const x = 1;
//@embedoc:constants id="config"
const API_URL = "https://api.example.com";
//@embedoc:end
const y = 2;
`;
    const markers = parseMarkers(content, DEFAULT_COMMENT_STYLES.line);
    
    expect(markers).toHaveLength(1);
    expect(markers[0].templateName).toBe('constants');
    expect(markers[0].params).toEqual({ id: 'config' });
  });

  it('should parse hash comment style markers', () => {
    const content = `
x = 1
#@embedoc:constants id="config"
API_URL = "https://api.example.com"
#@embedoc:end
y = 2
`;
    const markers = parseMarkers(content, DEFAULT_COMMENT_STYLES.hash);
    
    expect(markers).toHaveLength(1);
    expect(markers[0].templateName).toBe('constants');
    expect(markers[0].params).toEqual({ id: 'config' });
  });

  it('should parse SQL comment style markers', () => {
    const content = `
SELECT * FROM users;
--@embedoc:view_definition id="active_users"
CREATE VIEW active_users AS SELECT * FROM users WHERE active = true;
--@embedoc:end
SELECT * FROM orders;
`;
    const markers = parseMarkers(content, DEFAULT_COMMENT_STYLES.sql);
    
    expect(markers).toHaveLength(1);
    expect(markers[0].templateName).toBe('view_definition');
    expect(markers[0].params).toEqual({ id: 'active_users' });
  });

  it('should parse multiple markers in same file', () => {
    const content = `
<!--@embedoc:header id="main"-->
Header content
<!--@embedoc:end-->

Some text

<!--@embedoc:footer id="main"-->
Footer content
<!--@embedoc:end-->
`;
    const markers = parseMarkers(content, DEFAULT_COMMENT_STYLES.html);
    
    expect(markers).toHaveLength(2);
    expect(markers[0].templateName).toBe('header');
    expect(markers[1].templateName).toBe('footer');
  });

  it('should return empty array when no markers found', () => {
    const content = '# Just a title\n\nSome content without markers';
    const markers = parseMarkers(content, DEFAULT_COMMENT_STYLES.html);
    
    expect(markers).toHaveLength(0);
  });

  it('should handle markers without attributes', () => {
    const content = `
<!--@embedoc:table_index-->
| Table | Schema |
<!--@embedoc:end-->
`;
    const markers = parseMarkers(content, DEFAULT_COMMENT_STYLES.html);
    
    expect(markers).toHaveLength(1);
    expect(markers[0].templateName).toBe('table_index');
    expect(markers[0].params).toEqual({});
  });
});

describe('parseFrontmatter', () => {
  it('should parse YAML frontmatter', () => {
    const content = `---
doc_id: "users"
schema: "public"
---
# Title

Content here`;
    const result = parseFrontmatter(content);
    
    expect(result.data).toEqual({ doc_id: 'users', schema: 'public' });
    expect(result.content).toBe('# Title\n\nContent here');
    expect(result.raw).toContain('doc_id: "users"');
  });

  it('should handle content without frontmatter', () => {
    const content = '# Title\n\nContent here';
    const result = parseFrontmatter(content);
    
    expect(result.data).toEqual({});
    expect(result.content).toBe('# Title\n\nContent here');
    expect(result.raw).toBe('');
  });

  it('should handle nested frontmatter values', () => {
    const content = `---
config:
  database: postgres
  port: 5432
---
Content`;
    const result = parseFrontmatter(content);
    
    expect(result.data).toEqual({
      config: { database: 'postgres', port: 5432 },
    });
  });

  it('should handle array values in frontmatter', () => {
    const content = `---
embeds:
  - table_columns
  - table_relations
---
Content`;
    const result = parseFrontmatter(content);
    
    expect(result.data).toEqual({
      embeds: ['table_columns', 'table_relations'],
    });
  });
});

describe('resolveVariables', () => {
  it('should resolve simple variable references', () => {
    const params = { id: '${doc_id}' };
    const frontmatter = { doc_id: 'users' };
    const result = resolveVariables(params, frontmatter);
    
    expect(result).toEqual({ id: 'users' });
  });

  it('should resolve multiple variables', () => {
    const params = { id: '${schema}.${table}' };
    const frontmatter = { schema: 'public', table: 'users' };
    const result = resolveVariables(params, frontmatter);
    
    expect(result).toEqual({ id: 'public.users' });
  });

  it('should resolve nested variable references', () => {
    const params = { id: '${config.database}' };
    const frontmatter = { config: { database: 'mydb' } };
    const result = resolveVariables(params, frontmatter);
    
    expect(result).toEqual({ id: 'mydb' });
  });

  it('should return empty string for missing variables', () => {
    const params = { id: '${missing}' };
    const frontmatter = { other: 'value' };
    const result = resolveVariables(params, frontmatter);
    
    expect(result).toEqual({ id: '' });
  });

  it('should keep literal text when no variables', () => {
    const params = { id: 'users', schema: 'public' };
    const frontmatter = {};
    const result = resolveVariables(params, frontmatter);
    
    expect(result).toEqual({ id: 'users', schema: 'public' });
  });

  it('should mix literal and variable text', () => {
    const params = { query: 'SELECT * FROM ${table} WHERE active = true' };
    const frontmatter = { table: 'users' };
    const result = resolveVariables(params, frontmatter);
    
    expect(result).toEqual({ query: 'SELECT * FROM users WHERE active = true' });
  });
});

describe('getCommentStyle', () => {
  it('should return default HTML style', () => {
    const style = getCommentStyle('html');
    expect(style).toEqual({ start: '<!--', end: '-->' });
  });

  it('should return default block style', () => {
    const style = getCommentStyle('block');
    expect(style).toEqual({ start: '/*', end: '*/' });
  });

  it('should return default line style', () => {
    const style = getCommentStyle('line');
    expect(style).toEqual({ start: '//', end: '' });
  });

  it('should return custom style when provided', () => {
    const customStyles = {
      lua: { start: '--[[', end: ']]' },
    };
    const style = getCommentStyle('lua', customStyles);
    expect(style).toEqual({ start: '--[[', end: ']]' });
  });

  it('should throw for unknown style', () => {
    expect(() => getCommentStyle('unknown')).toThrow('Unknown comment style: unknown');
  });
});

describe('guessCommentStyle', () => {
  it('should guess html for .md files', () => {
    expect(guessCommentStyle('README.md')).toBe('html');
  });

  it('should guess html for .html files', () => {
    expect(guessCommentStyle('index.html')).toBe('html');
  });

  it('should guess block for .ts files', () => {
    expect(guessCommentStyle('app.ts')).toBe('block');
  });

  it('should guess block for .js files', () => {
    expect(guessCommentStyle('script.js')).toBe('block');
  });

  it('should guess hash for .py files', () => {
    expect(guessCommentStyle('main.py')).toBe('hash');
  });

  it('should guess sql for .sql files', () => {
    expect(guessCommentStyle('schema.sql')).toBe('sql');
  });

  it('should guess line for .go files', () => {
    expect(guessCommentStyle('main.go')).toBe('line');
  });

  it('should default to html for unknown extensions', () => {
    expect(guessCommentStyle('file.unknown')).toBe('html');
  });
});

