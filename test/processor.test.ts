import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { processFile, build } from '../src/core/processor.js';
import { writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { TargetConfig, EmbedocConfig, EmbedDefinition } from '../src/types/index.js';

describe('processFile', () => {
  let tempDir: string;
  let testFile: string;

  const targetConfig: TargetConfig = {
    pattern: '**/*.md',
    comment_style: 'html',
  };

  const config: EmbedocConfig = {
    version: '1.0',
    targets: [targetConfig],
  };

  beforeEach(async () => {
    // Create temp directory for test files
    tempDir = path.join(os.tmpdir(), `embedoc-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    testFile = path.join(tempDir, 'test.md');
  });

  afterEach(async () => {
    // Cleanup temp directory
    try {
      await rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('inline attribute', () => {
    it('should add newlines around content by default', async () => {
      const content = `<!--@embedoc:test_embed id="1"-->old<!--@embedoc:end-->`;
      await writeFile(testFile, content);

      const embeds: Record<string, EmbedDefinition> = {
        test_embed: {
          render: async () => ({ content: 'new content' }),
        },
      };

      await processFile(testFile, content, targetConfig, embeds, {}, config, false);

      const result = await readFile(testFile, 'utf-8');
      expect(result).toBe(
        `<!--@embedoc:test_embed id="1"-->\nnew content\n<!--@embedoc:end-->`
      );
    });

    it('should not add newlines when inline="true"', async () => {
      const content = `<!--@embedoc:test_embed id="1" inline="true"-->old<!--@embedoc:end-->`;
      await writeFile(testFile, content);

      const embeds: Record<string, EmbedDefinition> = {
        test_embed: {
          render: async () => ({ content: 'new content' }),
        },
      };

      await processFile(testFile, content, targetConfig, embeds, {}, config, false);

      const result = await readFile(testFile, 'utf-8');
      expect(result).toBe(
        `<!--@embedoc:test_embed id="1" inline="true"-->new content<!--@embedoc:end-->`
      );
    });

    it('should work with inline="true" in table cells', async () => {
      const content = `| Name | <!--@embedoc:test_embed inline="true"-->old<!--@embedoc:end--> |`;
      await writeFile(testFile, content);

      const embeds: Record<string, EmbedDefinition> = {
        test_embed: {
          render: async () => ({ content: 'value' }),
        },
      };

      await processFile(testFile, content, targetConfig, embeds, {}, config, false);

      const result = await readFile(testFile, 'utf-8');
      expect(result).toBe(
        `| Name | <!--@embedoc:test_embed inline="true"-->value<!--@embedoc:end--> |`
      );
    });

    it('should preserve inline="false" behavior (with newlines)', async () => {
      const content = `<!--@embedoc:test_embed inline="false"-->old<!--@embedoc:end-->`;
      await writeFile(testFile, content);

      const embeds: Record<string, EmbedDefinition> = {
        test_embed: {
          render: async () => ({ content: 'new' }),
        },
      };

      await processFile(testFile, content, targetConfig, embeds, {}, config, false);

      const result = await readFile(testFile, 'utf-8');
      expect(result).toBe(
        `<!--@embedoc:test_embed inline="false"-->\nnew\n<!--@embedoc:end-->`
      );
    });
  });

  describe('indented markers', () => {
    it('should keep the end marker at the indentation it was written at', async () => {
      const content = `  <!--@embedoc:test_embed-->\n  old\n  <!--@embedoc:end-->`;
      await writeFile(testFile, content);

      const embeds: Record<string, EmbedDefinition> = {
        test_embed: {
          render: async () => ({ content: '  new' }),
        },
      };

      await processFile(testFile, content, targetConfig, embeds, {}, config, false);

      const result = await readFile(testFile, 'utf-8');
      expect(result).toBe(
        `  <!--@embedoc:test_embed-->\n  new\n  <!--@embedoc:end-->`
      );
    });

    it('should not hand the end marker indentation to the embed as content', async () => {
      const content = `  <!--@embedoc:test_embed-->\n  old\n  <!--@embedoc:end-->`;
      await writeFile(testFile, content);

      let seen: string | undefined;
      const embeds: Record<string, EmbedDefinition> = {
        test_embed: {
          render: async (ctx) => {
            seen = ctx.existingContent;
            return { content: '  new' };
          },
        },
      };

      await processFile(testFile, content, targetConfig, embeds, {}, config, false);

      expect(seen).toBe('\n  old\n');
    });
  });

  describe('existing content preservation (null/undefined return)', () => {
    it('should keep existing content when embed returns null', async () => {
      const content = `<!--@embedoc:test_embed id="1"-->\nexisting content\n<!--@embedoc:end-->`;
      await writeFile(testFile, content);

      const embeds: Record<string, EmbedDefinition> = {
        test_embed: {
          render: async () => ({ content: null }),
        },
      };

      await processFile(testFile, content, targetConfig, embeds, {}, config, false);

      const result = await readFile(testFile, 'utf-8');
      expect(result).toBe(content);
    });

    it('should keep existing content when embed returns undefined', async () => {
      const content = `<!--@embedoc:test_embed id="1"-->\nexisting content\n<!--@embedoc:end-->`;
      await writeFile(testFile, content);

      const embeds: Record<string, EmbedDefinition> = {
        test_embed: {
          render: async () => ({ content: undefined }),
        },
      };

      await processFile(testFile, content, targetConfig, embeds, {}, config, false);

      const result = await readFile(testFile, 'utf-8');
      expect(result).toBe(content);
    });

    it('should provide existingContent in context', async () => {
      const existingContent = 'previous generated content';
      const content = `<!--@embedoc:test_embed id="1"-->\n${existingContent}\n<!--@embedoc:end-->`;
      await writeFile(testFile, content);

      let capturedExistingContent: string | undefined;

      const embeds: Record<string, EmbedDefinition> = {
        test_embed: {
          render: async (ctx) => {
            capturedExistingContent = ctx.existingContent;
            return { content: 'new content' };
          },
        },
      };

      await processFile(testFile, content, targetConfig, embeds, {}, config, false);

      expect(capturedExistingContent).toBe(`\n${existingContent}\n`);
    });

    it('should allow embed to return null for error recovery using existingContent check', async () => {
      const existingContent = 'fallback content';
      const content = `<!--@embedoc:test_embed id="1"-->\n${existingContent}\n<!--@embedoc:end-->`;
      await writeFile(testFile, content);

      const embeds: Record<string, EmbedDefinition> = {
        test_embed: {
          render: async (ctx) => {
            // Simulate error recovery: return null when error occurs
            // (existingContent is available in ctx for conditional logic)
            const simulatedError = true;
            if (simulatedError && ctx.existingContent) {
              // Return null to keep existing content unchanged
              return { content: null };
            }
            return { content: 'new content' };
          },
        },
      };

      await processFile(testFile, content, targetConfig, embeds, {}, config, false);

      const result = await readFile(testFile, 'utf-8');
      expect(result).toBe(content);
    });

    it('should not mark file as changed when returning null', async () => {
      const content = `<!--@embedoc:test_embed id="1"-->\nexisting\n<!--@embedoc:end-->`;
      await writeFile(testFile, content);

      const embeds: Record<string, EmbedDefinition> = {
        test_embed: {
          render: async () => ({ content: null }),
        },
      };

      const result = await processFile(testFile, content, targetConfig, embeds, {}, config, false);

      expect(result.changed).toBe(false);
      expect(result.markersUpdated).toBe(0);
    });

    it('should handle multiple markers with mixed null and string returns', async () => {
      const content = `<!--@embedoc:embed_a id="1"-->\ncontent A\n<!--@embedoc:end-->\n\n<!--@embedoc:embed_b id="2"-->\ncontent B\n<!--@embedoc:end-->`;
      await writeFile(testFile, content);

      const embeds: Record<string, EmbedDefinition> = {
        embed_a: {
          render: async () => ({ content: null }), // Keep existing
        },
        embed_b: {
          render: async () => ({ content: 'updated B' }), // Replace
        },
      };

      await processFile(testFile, content, targetConfig, embeds, {}, config, false);

      const result = await readFile(testFile, 'utf-8');
      expect(result).toBe(
        `<!--@embedoc:embed_a id="1"-->\ncontent A\n<!--@embedoc:end-->\n\n<!--@embedoc:embed_b id="2"-->\nupdated B\n<!--@embedoc:end-->`
      );
    });
  });
});

describe('build with specific files', () => {
  let tempDir: string;
  const embeds: Record<string, EmbedDefinition> = {
    hello: { async render() { return { content: 'hello' }; } },
  };
  const marker = '<!--@embedoc:hello-->\n<!--@embedoc:end-->\n';

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `embedoc-build-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(path.join(tempDir, 'docs', 'skip'), { recursive: true });
    await writeFile(path.join(tempDir, 'README.md'), marker);
    await writeFile(path.join(tempDir, 'docs', 'a.md'), marker);
    await writeFile(path.join(tempDir, 'docs', 'skip', 'b.md'), marker);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  function config(): EmbedocConfig {
    return {
      version: '1.0',
      targets: [
        { pattern: path.join(tempDir, 'README.md'), comment_style: 'html' },
        { pattern: path.join(tempDir, 'docs', '**', '*.md'), comment_style: 'html', exclude: ['**/skip/**'] },
      ],
    };
  }

  it('processes a named file once, by the target that covers it', async () => {
    const result = await build(config(), embeds, {}, { specificFiles: [path.join(tempDir, 'README.md')] });
    expect(result.results.map((r) => r.filePath)).toEqual([path.join(tempDir, 'README.md')]);
  });

  it('does not process a named file that its target excludes', async () => {
    const skipped = path.join(tempDir, 'docs', 'skip', 'b.md');
    const result = await build(config(), embeds, {}, { specificFiles: [skipped] });
    expect(result.totalFiles).toBe(0);
    expect(await readFile(skipped, 'utf-8')).toBe(marker);
  });

  it('builds the same files as a full build when every file is named', async () => {
    const all = await build(config(), embeds, {}, { dryRun: true });
    const named = await build(config(), embeds, {}, {
      dryRun: true,
      specificFiles: all.results.map((r) => r.filePath),
    });
    expect(named.results.map((r) => r.filePath)).toEqual(all.results.map((r) => r.filePath));
    expect(all.results.map((r) => path.relative(tempDir, r.filePath)).sort()).toEqual(['README.md', path.join('docs', 'a.md')]);
  });
});

describe('generated content is content', () => {
  const target: TargetConfig = { pattern: '**/*.md', comment_style: 'html' };
  const cfg: EmbedocConfig = { version: '1.0', targets: [target] };
  let dir: string;

  beforeEach(async () => {
    dir = path.join(os.tmpdir(), `embedoc-generated-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const listDatasources: EmbedDefinition = {
    render: async (ctx) => ({ content: `ds=${Object.keys(ctx.datasources).sort().join(',')}` }),
  };

  async function buildTwice(file: string, doc: string, embeds: Record<string, EmbedDefinition>) {
    await writeFile(file, doc);
    const first = await processFile(file, doc, target, embeds, {}, cfg);
    const second = await processFile(file, await readFile(file, 'utf-8'), target, embeds, {}, cfg);
    return { first, second, content: await readFile(file, 'utf-8') };
  }

  it('does not read an inline data marker in generated content as a definition', async () => {
    const embeds: Record<string, EmbedDefinition> = {
      quote: { render: async () => ({ content: 'see <!--@embedoc-data:quoted format="json"-->{"k":1}<!--@embedoc-data:end-->' }) },
      list: listDatasources,
    };
    const doc = '<!--@embedoc:quote-->\n<!--@embedoc:end-->\n<!--@embedoc:list-->\n<!--@embedoc:end-->\n';
    const { first, second, content } = await buildTwice(path.join(dir, 'a.md'), doc, embeds);
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(content).toContain('ds=\n');
  });

  it('fails a file whose generated content would end its block early, and leaves it unwritten', async () => {
    const called: string[] = [];
    const embeds: Record<string, EmbedDefinition> = {
      cell: { render: async () => ({ content: 'x <!--@embedoc:end-->\n<!--@embedoc:other mode="m"-->' }) },
      other: { render: async (ctx) => { called.push(ctx.params['mode'] ?? ''); return { content: 'o' }; } },
      nested: { render: async () => ({ content: '<!--@embedoc:other-->o<!--@embedoc:end-->' }) },
      fence: { render: async () => ({ content: '```\nopen fence' }) },
    };
    for (const name of ['cell', 'nested', 'fence']) {
      const file = path.join(dir, `${name}.md`);
      const doc = `<!--@embedoc:${name}-->\n<!--@embedoc:end-->\n`;
      await writeFile(file, doc);
      const result = await processFile(file, doc, target, embeds, {}, cfg);
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain(`Output of embed "${name}"`);
      expect(await readFile(file, 'utf-8')).toBe(doc);
    }
    expect(called).toEqual([]);
  });

  it('keeps marker syntax inside a closed code fence of generated content', async () => {
    const embeds: Record<string, EmbedDefinition> = {
      example: { render: async () => ({ content: '```md\n<!--@embedoc:x-->\n<!--@embedoc:end-->\n```' }) },
    };
    const doc = '<!--@embedoc:example-->\n<!--@embedoc:end-->\n';
    const { first, second, content } = await buildTwice(path.join(dir, 'e.md'), doc, embeds);
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(content).toBe('<!--@embedoc:example-->\n```md\n<!--@embedoc:x-->\n<!--@embedoc:end-->\n```\n<!--@embedoc:end-->\n');
  });

  it('does not take an inherited name for an external datasource', async () => {
    const doc = '<!--@embedoc-data:constructor format="yaml"-->a: 1<!--@embedoc-data:end-->\n<!--@embedoc:list-->\n<!--@embedoc:end-->\n';
    const strict: EmbedocConfig = { ...cfg, inline_datasource: { conflictPolicy: 'error' } };
    const result = await processFile(path.join(dir, 'c.md'), doc, target, { list: listDatasources }, {}, strict, true);
    expect(result.error?.message).toBeUndefined();
    expect(result.success).toBe(true);
  });
});
