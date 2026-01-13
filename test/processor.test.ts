import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { processFile } from '../src/core/processor.js';
import { writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { TargetConfig, EmbedifyConfig, EmbedDefinition } from '../src/types/index.js';

describe('processFile', () => {
  let tempDir: string;
  let testFile: string;

  const targetConfig: TargetConfig = {
    pattern: '**/*.md',
    comment_style: 'html',
  };

  const config: EmbedifyConfig = {
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
});
