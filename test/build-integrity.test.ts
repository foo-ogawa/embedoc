/**
 * A build changes nothing outside the markers (#43), markers or
 * renderers it cannot honour fail the build (#44), and renderers can
 * import embedoc in CommonJS and ES module projects.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { processFile } from '../src/core/processor.js';
import type { EmbedDefinition, EmbedocConfig, TargetConfig } from '../src/types/index.js';

const CLI = resolve('dist/cli.js');
const target: TargetConfig = { pattern: '**/*.md', comment_style: 'html' };
const embeds: Record<string, EmbedDefinition> = {
  hello: { async render() { return { content: 'hello' }; } },
};

/** The document with every marker block (start marker to end marker) cut out. */
function outsideMarkers(text: string): string {
  return text.replace(/<!--@embedoc:(?!end)[\s\S]*?<!--@embedoc:end-->/g, '<MARKER>');
}

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'embedoc-integrity-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true });
});

async function build(name: string, text: string, config: EmbedocConfig = { version: '1.0', targets: [target] }) {
  const file = join(dir, name);
  await writeFile(file, text);
  const result = await processFile(file, text, target, embeds, {}, config);
  return { result, written: await readFile(file, 'utf-8') };
}

function cli(args: string[], cwd: string): Promise<{ code: number; output: string }> {
  return new Promise((done) => {
    execFile('node', [CLI, ...args], { cwd }, (error, stdout, stderr) => {
      done({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, output: stdout + stderr });
    });
  });
}

async function project(renderersIndex: string, doc: string): Promise<void> {
  await mkdir(join(dir, '.embedoc', 'renderers'), { recursive: true });
  await writeFile(join(dir, '.embedoc', 'renderers', 'index.ts'), renderersIndex);
  await writeFile(
    join(dir, 'embedoc.config.yaml'),
    'version: "1.0"\ntargets:\n  - pattern: "./*.md"\n    comment_style: html\n'
  );
  await writeFile(join(dir, 'doc.md'), doc);
}

const goodRenderers =
  "export const embeds = { hello: { async render() { return { content: 'hello' }; } } };\n";
const doc = '<!--@embedoc:hello-->\nold\n<!--@embedoc:end-->\n';

describe('outside the markers, a build changes nothing (#43)', () => {
  const marker = '<!--@embedoc:hello-->\nold\n<!--@embedoc:end-->';
  const cases: [string, string][] = [
    ['no front matter', `# Title\n\n${marker}\n\ntext\n`],
    ['front matter, no blank line after it', `---\ntitle: A\n---\n# Title\n${marker}\n`],
    ['front matter, one blank line after it', `---\ntitle: A\n---\n\n# Title\n${marker}\n`],
    ['front matter, two blank lines after it', `---\ntitle: A\n---\n\n\n# Title\n${marker}\n`],
    ['front matter with trailing spaces and a blank line inside', `---\ntitle: A  \n\nlist:\n  - x\n---\n\n${marker}\n`],
    ['CRLF line endings', `---\r\ntitle: A\r\n---\r\n\r\n# Title\r\n${marker.replace(/\n/g, '\r\n')}\r\n\r\ntext\r\n`],
  ];

  for (const [name, text] of cases) {
    it(name, async () => {
      const { result, written } = await build('doc.md', text);
      expect(result.success).toBe(true);
      expect(result.markersUpdated).toBe(1);
      expect(written).toContain('<!--@embedoc:hello-->\nhello\n<!--@embedoc:end-->');
      expect(outsideMarkers(written)).toBe(outsideMarkers(text));
    });
  }

  it('leaves a file whose markers are current byte for byte the same', async () => {
    const text = `---\ntitle: A\n---\n\n\n<!--@embedoc:hello-->\nhello\n<!--@embedoc:end-->\n`;
    const { result, written } = await build('doc.md', text);
    expect(result.changed).toBe(false);
    expect(written).toBe(text);
  });

  it('with line_ending crlf, writes CRLF once (not CR CR LF) for a CRLF file', async () => {
    const text = `---\r\ntitle: A\r\n---\r\n\r\n<!--@embedoc:hello-->\r\nold\r\n<!--@embedoc:end-->\r\n`;
    const { written } = await build('doc.md', text, {
      version: '1.0',
      targets: [target],
      output: { line_ending: 'crlf' },
    });
    expect(written).not.toContain('\r\r');
    expect(outsideMarkers(written)).toBe(outsideMarkers(text));
  });
});

describe('markers and renderers the build cannot honour fail it (#44)', () => {
  it('fails the file for a marker whose embed is unknown, and names the file and line', async () => {
    const text = `---\ntitle: A\n---\n\n<!--@embedoc:hello-->\nold\n<!--@embedoc:end-->\n<!--@embedoc:missing-->\nold\n<!--@embedoc:end-->\n`;
    const { result, written } = await build('doc.md', text);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe(
      `Unknown embed "missing" at ${join(dir, 'doc.md')}:8 (no renderer has this name)`
    );
    expect(written).toBe(text); // nothing is written for a failed file
  });

  it('exits 0 when every marker has a renderer', async () => {
    await project(goodRenderers, doc);
    const { code } = await cli(['build'], dir);
    expect(code).toBe(0);
  }, 60_000);

  it('exits non-zero for an unknown embed', async () => {
    await project(goodRenderers, doc + '<!--@embedoc:missing-->\nold\n<!--@embedoc:end-->\n');
    const { code, output } = await cli(['build'], dir);
    expect(code).not.toBe(0);
    expect(output).toContain('Unknown embed "missing"');
  }, 60_000);

  it('exits non-zero when the renderers cannot be loaded', async () => {
    await project("throw new Error('broken renderer');\n", doc);
    const { code, output } = await cli(['build'], dir);
    expect(code).not.toBe(0);
    expect(output).toContain('Could not load renderers');
    expect(await readFile(join(dir, 'doc.md'), 'utf-8')).toBe(doc);
  }, 60_000);
});

describe('renderers import embedoc in CommonJS and ES module projects', () => {
  const renderers =
    "import { defineEmbed } from 'embedoc';\n" +
    "export const embeds = { hello: defineEmbed({ async render() { return { content: 'hello' }; } }) };\n";
  const projects: [string, Record<string, string>][] = [
    ['CommonJS project (no "type")', {}],
    ['ES module project ("type": "module")', { type: 'module' }],
  ];

  for (const [name, type] of projects) {
    it(name, async () => {
      await project(renderers, doc);
      await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'consumer', private: true, ...type }));
      await mkdir(join(dir, 'node_modules'));
      await symlink(resolve('.'), join(dir, 'node_modules', 'embedoc'), 'dir');
      const { code, output } = await cli(['build'], dir);
      expect(output).not.toContain('Could not load renderers');
      expect(code).toBe(0);
      expect(await readFile(join(dir, 'doc.md'), 'utf-8')).toBe('<!--@embedoc:hello-->\nhello\n<!--@embedoc:end-->\n');
    }, 60_000);
  }
});
