import { describe, it, expect } from 'vitest';
import { createMarkdownHelper } from '../src/helpers/markdown.js';

describe('MarkdownHelper', () => {
  const md = createMarkdownHelper();

  describe('table', () => {
    it('should generate a simple table', () => {
      const result = md.table(['Name', 'Age'], [['Alice', 25], ['Bob', 30]]);
      expect(result).toBe(
        '| Name | Age |\n' +
        '| --- | --- |\n' +
        '| Alice | 25 |\n' +
        '| Bob | 30 |'
      );
    });

    it('should handle empty table', () => {
      const result = md.table([], []);
      expect(result).toBe('');
    });

    it('should escape pipe characters', () => {
      const result = md.table(['Command'], [['echo "hello | world"']]);
      expect(result).toContain('echo "hello \\| world"');
    });

    it('should handle null and undefined values', () => {
      const result = md.table(['A', 'B'], [[null, undefined]]);
      expect(result).toBe(
        '| A | B |\n' +
        '| --- | --- |\n' +
        '|  |  |'
      );
    });

    it('should handle boolean values', () => {
      const result = md.table(['Active'], [[true], [false]]);
      expect(result).toContain('| true |');
      expect(result).toContain('| false |');
    });

    it('should convert newlines to <br>', () => {
      const result = md.table(['Text'], [['line1\nline2']]);
      expect(result).toContain('line1<br>line2');
    });
  });

  describe('list', () => {
    it('should generate unordered list by default', () => {
      const result = md.list(['Item 1', 'Item 2', 'Item 3']);
      expect(result).toBe('- Item 1\n- Item 2\n- Item 3');
    });

    it('should generate ordered list when specified', () => {
      const result = md.list(['First', 'Second', 'Third'], true);
      expect(result).toBe('1. First\n2. Second\n3. Third');
    });

    it('should handle empty list', () => {
      const result = md.list([]);
      expect(result).toBe('');
    });

    it('should handle single item', () => {
      const result = md.list(['Only item']);
      expect(result).toBe('- Only item');
    });
  });

  describe('codeBlock', () => {
    it('should generate code block with language', () => {
      const result = md.codeBlock('const x = 1;', 'typescript');
      expect(result).toBe('```typescript\nconst x = 1;\n```');
    });

    it('should generate code block without language', () => {
      const result = md.codeBlock('some code');
      expect(result).toBe('```\nsome code\n```');
    });

    it('should handle multiline code', () => {
      const code = 'function foo() {\n  return 42;\n}';
      const result = md.codeBlock(code, 'javascript');
      expect(result).toBe('```javascript\nfunction foo() {\n  return 42;\n}\n```');
    });
  });

  describe('link', () => {
    it('should generate a link', () => {
      const result = md.link('Click here', 'https://example.com');
      expect(result).toBe('[Click here](https://example.com)');
    });

    it('should handle relative paths', () => {
      const result = md.link('Local file', './docs/readme.md');
      expect(result).toBe('[Local file](./docs/readme.md)');
    });
  });

  describe('heading', () => {
    it('should generate h1 by default', () => {
      const result = md.heading('Title');
      expect(result).toBe('# Title');
    });

    it('should generate specified heading level', () => {
      expect(md.heading('H2', 2)).toBe('## H2');
      expect(md.heading('H3', 3)).toBe('### H3');
      expect(md.heading('H6', 6)).toBe('###### H6');
    });

    it('should clamp heading level to 1-6', () => {
      expect(md.heading('Too low', 0)).toBe('# Too low');
      expect(md.heading('Too high', 10)).toBe('###### Too high');
    });
  });

  describe('bold', () => {
    it('should wrap text in bold', () => {
      const result = md.bold('important');
      expect(result).toBe('**important**');
    });
  });

  describe('italic', () => {
    it('should wrap text in italic', () => {
      const result = md.italic('emphasis');
      expect(result).toBe('*emphasis*');
    });
  });

  describe('checkbox', () => {
    it('should return checkmark for true', () => {
      const result = md.checkbox(true);
      expect(result).toBe('✔');
    });

    it('should return empty string for false', () => {
      const result = md.checkbox(false);
      expect(result).toBe('');
    });
  });
});

