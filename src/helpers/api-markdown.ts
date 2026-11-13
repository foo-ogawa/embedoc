/**
 * API Markdown Helper
 * Render records of the `typescript` datasource (ApiSymbol) as Markdown.
 */

import type {
  ApiMember,
  ApiSignature,
  ApiSource,
  ApiSymbol,
  ApiSymbolKind,
  ApiTag,
  ApiTypeParameter,
  QueryResult,
} from '../types/index.js';
import { INLINE_LINK } from '../datasources/typescript.js';

/**
 * Options for {@link renderApiIndex} and {@link renderApiPage}.
 */
export interface ApiMarkdownOptions {
  /**
   * Kinds whose symbols get a page of their own at `<kindDir>/<name>.md`
   * (e.g. `['class', 'interface', 'function']`). Symbols of the other kinds are
   * written in full on the index page. Default: none, so everything is on the index.
   */
  ownFileKinds?: ApiSymbolKind[];
  /**
   * Order of category headings. `*` marks where the categories that are not
   * listed go (alphabetically); without `*` they go last. Symbols without a
   * `@category` tag are in the category `Other`. Category headings appear only in
   * kind groups where at least one symbol has a category.
   */
  categoryOrder?: string[];
  /** File name of the index page, for links from symbol pages (default: `README.md`). */
  indexFile?: string;
  /** Heading level of the kind groups on the index page (default: 2). */
  headingLevel?: number;
}

/** Kind groups on the index page, in this order. */
const KIND_GROUPS: { kind: ApiSymbolKind; title: string }[] = [
  { kind: 'namespace', title: 'Namespaces' },
  { kind: 'enum', title: 'Enumerations' },
  { kind: 'class', title: 'Classes' },
  { kind: 'interface', title: 'Interfaces' },
  { kind: 'type', title: 'Type Aliases' },
  { kind: 'variable', title: 'Variables' },
  { kind: 'function', title: 'Functions' },
  { kind: 'reference', title: 'References' },
];

const MEMBER_GROUPS: { kind: ApiMember['kind']; title: string }[] = [
  { kind: 'constructor', title: 'Constructors' },
  { kind: 'call-signature', title: 'Call Signature' },
  { kind: 'index-signature', title: 'Indexable' },
  { kind: 'property', title: 'Properties' },
  { kind: 'accessor', title: 'Accessors' },
  { kind: 'method', title: 'Methods' },
  { kind: 'enum-member', title: 'Enumeration Members' },
];

const DEFAULT_CATEGORY = 'Other';

/** Tags rendered in their own way (not as a generic section). */
const SPECIAL_TAGS = new Set([
  'example',
  'deprecated',
  'see',
  'remarks',
  'default',
  'defaultValue',
  'internal',
  'category', // grouping on the index, not text
]);

interface Context {
  ownFileKinds: Set<ApiSymbolKind>;
  categoryOrder: string[];
  indexFile: string;
  /** True when rendering a page of its own (links are relative to `<kindDir>/`). */
  onOwnPage: boolean;
  symbol: ApiSymbol;
}

function toSymbol(row: Record<string, unknown>): ApiSymbol {
  if (
    typeof row['name'] !== 'string' ||
    typeof row['kind'] !== 'string' ||
    typeof row['kindDir'] !== 'string' ||
    !Array.isArray(row['members'])
  ) {
    throw new Error('Expected a record of the "typescript" datasource (ApiSymbol)');
  }
  return row as unknown as ApiSymbol;
}

/** GitHub-style heading anchor. */
function anchor(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

function heading(level: number, text: string): string {
  return `${'#'.repeat(Math.min(Math.max(level, 1), 6))} ${text}`;
}

/** Escape text that is used in a heading or as plain Markdown. */
function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_<>[\]|])/g, '\\$1');
}

/** Inline code that survives backticks in the text. */
function code(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const fence = flat.includes('`') ? '``' : '`';
  const pad = fence === '``' ? ' ' : '';
  return `${fence}${pad}${flat}${pad}${fence}`;
}

/** A table cell: one line, pipes escaped. */
function cell(text: string): string {
  return text
    .replace(/\r?\n\s*\r?\n/g, '<br><br>')
    .replace(/\s*\r?\n\s*/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

function linkPath(ctx: Context, name: string, kind: ApiSymbolKind, kindDir: string, member: string | null): string {
  if (ctx.ownFileKinds.has(kind)) {
    const file = `${kindDir}/${name}.md`;
    const path = ctx.onOwnPage ? `../${file}` : file;
    return member ? `${path}#${anchor(member)}` : path;
  }
  const target = `#${anchor(name)}`;
  return ctx.onOwnPage ? `../${ctx.indexFile}${target}` : target;
}

/** Replace `{@link ...}` with Markdown links (or code when the target is not an exported symbol). */
function resolveText(ctx: Context, text: string): string {
  return text.replace(INLINE_LINK, (_match, target: string, label: string) => {
    const shown = label.trim() || target;
    const link = ctx.symbol.links.find((l) => l.target === target);
    if (!link) return code(shown);
    return `[${code(shown)}](${linkPath(ctx, link.name, link.kind, link.kindDir, link.member)})`;
  });
}

function definedIn(source: ApiSource): string {
  const label = `${source.file}:${source.line}`;
  return source.url ? `Defined in: [${label}](${source.url})` : `Defined in: ${label}`;
}

function codeBlock(text: string): string {
  return ['```ts', text, '```'].join('\n');
}

function tagsNamed(tags: ApiTag[], name: string): ApiTag[] {
  return tags.filter((t) => t.tag === name);
}

/** Summary, deprecation, remarks, examples, see-also and other tags. */
function docBlocks(ctx: Context, summary: string, tags: ApiTag[], level: number): string[] {
  const out: string[] = [];
  for (const t of tagsNamed(tags, 'deprecated')) {
    out.push(`> **Deprecated**${t.text ? ` ${resolveText(ctx, t.text)}` : ''}`);
  }
  if (summary) out.push(resolveText(ctx, summary));
  for (const t of tagsNamed(tags, 'remarks')) {
    out.push(heading(level, 'Remarks'), resolveText(ctx, t.text));
  }
  for (const t of tags) {
    if (SPECIAL_TAGS.has(t.tag)) continue;
    const title = t.tag.charAt(0).toUpperCase() + t.tag.slice(1);
    out.push(heading(level, title));
    if (t.text) out.push(resolveText(ctx, t.text));
  }
  const examples = tagsNamed(tags, 'example');
  if (examples.length > 0) {
    out.push(heading(level, examples.length > 1 ? 'Examples' : 'Example'));
    for (const t of examples) {
      const [first = '', ...rest] = t.text.split('\n');
      // A first line that is not code is the title of the example.
      if (first.trim() !== '' && !first.trimStart().startsWith('```') && rest.some((l) => l.trimStart().startsWith('```'))) {
        out.push(heading(level + 1, escapeMarkdown(first.trim())), rest.join('\n').trim());
      } else {
        out.push(t.text);
      }
    }
  }
  const sees = tagsNamed(tags, 'see');
  if (sees.length > 0) {
    out.push(heading(level, 'See'), sees.map((t) => `- ${resolveText(ctx, t.text)}`).join('\n'));
  }
  return out;
}

/** Description used in a table cell, with `@default` / `@deprecated` folded in. */
function cellDescription(ctx: Context, summary: string, tags: ApiTag[]): string {
  const parts: string[] = [];
  for (const t of tagsNamed(tags, 'deprecated')) parts.push(`**Deprecated**${t.text ? ` ${t.text}` : ''}`);
  if (summary) parts.push(summary);
  for (const t of [...tagsNamed(tags, 'default'), ...tagsNamed(tags, 'defaultValue')]) {
    parts.push(`**Default** ${code(t.text)}`);
  }
  return cell(resolveText(ctx, parts.join('\n\n')));
}

function typeParameterTable(ctx: Context, params: ApiTypeParameter[], level: number): string[] {
  if (params.length === 0) return [];
  const withDescription = params.some((p) => p.description);
  const rows = params.map((p) => {
    let name = p.name;
    if (p.constraint) name += ` extends ${p.constraint}`;
    if (p.default) name += ` = ${p.default}`;
    const cols = [code(name)];
    if (withDescription) cols.push(cell(resolveText(ctx, p.description)));
    return `| ${cols.join(' | ')} |`;
  });
  const header = withDescription ? '| Type Parameter | Description |\n| ------ | ------ |' : '| Type Parameter |\n| ------ |';
  return [heading(level, 'Type Parameters'), [header, ...rows].join('\n')];
}

function signatureBlocks(ctx: Context, sig: ApiSignature, level: number): string[] {
  const out: string[] = [codeBlock(sig.code), definedIn(sig.source)];
  out.push(...docBlocks(ctx, sig.summary, sig.tags, level));
  out.push(...typeParameterTable(ctx, sig.typeParameters, level));
  if (sig.parameters.length > 0) {
    const withDescription = sig.parameters.some((p) => p.description);
    const header = withDescription ? '| Parameter | Type | Description |\n| ------ | ------ | ------ |' : '| Parameter | Type |\n| ------ | ------ |';
    const rows = sig.parameters.map((p) => {
      const name = `${p.rest ? '...' : ''}${p.name}${p.optional && !p.rest ? '?' : ''}`;
      const cols = [code(name), code(p.type)];
      if (withDescription) {
        let description = resolveText(ctx, p.description);
        if (p.defaultValue !== null) description += `${description ? ' ' : ''}**Default** ${code(p.defaultValue)}`;
        cols.push(cell(description));
      }
      return `| ${cols.join(' | ')} |`;
    });
    out.push(heading(level, 'Parameters'), [header, ...rows].join('\n'));
  }
  if (sig.returns) {
    out.push(heading(level, 'Returns'), code(sig.returns.type));
    if (sig.returns.description) out.push(resolveText(ctx, sig.returns.description));
  }
  return out;
}

function memberTitle(member: ApiMember): string {
  const flags = [member.static ? 'static ' : '', member.abstract ? 'abstract ' : ''].join('');
  const name = member.kind === 'method' ? `${member.name}()` : member.name;
  return escapeMarkdown(`${flags}${name}`);
}

function memberBlocks(ctx: Context, members: ApiMember[], level: number): string[] {
  const out: string[] = [];
  for (const group of MEMBER_GROUPS) {
    const list = members.filter((m) => m.kind === group.kind);
    if (list.length === 0) continue;
    out.push(heading(level, group.title));

    if (group.kind === 'property' || group.kind === 'enum-member' || group.kind === 'index-signature') {
      const isEnum = group.kind === 'enum-member';
      const header = isEnum
        ? '| Member | Value | Description | Defined in |\n| ------ | ------ | ------ | ------ |'
        : `| ${group.kind === 'index-signature' ? 'Index' : 'Property'} | Type | Description | Defined in |\n| ------ | ------ | ------ | ------ |`;
      const rows = list.map((m) => {
        const flags = [m.static ? 'static' : '', m.readonly && !isEnum ? 'readonly' : '', m.protected ? 'protected' : '']
          .filter(Boolean)
          .join(' ');
        const name = `<a id="${anchor(m.name)}"></a> ${code(`${m.name}${m.optional ? '?' : ''}`)}${flags ? ` (${flags})` : ''}`;
        const source = m.source.url ? `[${m.source.file}:${m.source.line}](${m.source.url})` : `${m.source.file}:${m.source.line}`;
        return `| ${name} | ${m.type === null ? '' : code(m.type)} | ${cellDescription(ctx, m.summary, m.tags)} | ${source} |`;
      });
      out.push([header, ...rows].join('\n'));
      continue;
    }

    list.forEach((m, i) => {
      if (i > 0) out.push('***');
      if (group.kind !== 'call-signature') out.push(heading(level + 1, memberTitle(m)));
      const signatureLevel = group.kind === 'call-signature' ? level + 1 : level + 2;
      const memberDoc = m.signatures.length === 0 ? docBlocks(ctx, m.summary, m.tags, signatureLevel) : [];
      out.push(...memberDoc);
      m.signatures.forEach((sig, j) => {
        if (j > 0) out.push('***');
        const doc = sig.summary || sig.tags.length > 0 ? sig : { ...sig, summary: m.summary, tags: m.tags };
        out.push(...signatureBlocks(ctx, doc, signatureLevel));
      });
    });
  }
  return out;
}

/** Body of a symbol (everything below its title). Section headings start at `level`. */
function symbolBody(ctx: Context, level: number): string[] {
  const s = ctx.symbol;
  const out: string[] = [];
  if (s.referenceOf !== null) {
    const link = s.links.find((l) => l.target === s.referenceOf);
    const target = link
      ? `[${escapeMarkdown(s.referenceOf)}](${linkPath(ctx, link.name, link.kind, link.kindDir, null)})`
      : code(s.referenceOf);
    out.push(`Renames and re-exports ${target}`);
    out.push(...docBlocks(ctx, s.summary, s.tags, level));
    return out;
  }
  if (s.code) out.push(codeBlock(s.code));
  // A function's documentation is on its signatures.
  if (s.kind !== 'function') {
    out.push(definedIn(s.source));
    out.push(...docBlocks(ctx, s.summary, s.tags, level));
  }
  if (s.extends.length > 0) out.push(heading(level, 'Extends'), s.extends.map((t) => `- ${code(t)}`).join('\n'));
  if (s.implements.length > 0) out.push(heading(level, 'Implements'), s.implements.map((t) => `- ${code(t)}`).join('\n'));
  if (s.kind !== 'function') out.push(...typeParameterTable(ctx, s.typeParameters, level));
  if (s.kind === 'function') {
    s.signatures.forEach((sig, i) => {
      if (i > 0) out.push('***');
      out.push(...signatureBlocks(ctx, sig, level));
    });
  }
  out.push(...memberBlocks(ctx, s.members, level));
  return out;
}

/**
 * Title of a symbol. Headings on the index leave out the type parameters so that
 * their anchor is the plain name, which is what links to them use.
 */
function symbolTitle(s: ApiSymbol, withTypeParameters: boolean): string {
  const params =
    withTypeParameters && s.typeParameters.length > 0 ? `<${s.typeParameters.map((p) => p.name).join(', ')}>` : '';
  const call = s.kind === 'function' ? '()' : '';
  return escapeMarkdown(`${s.name}${call}${params}`);
}

function ownFileKinds(options: ApiMarkdownOptions): Set<ApiSymbolKind> {
  const kinds = options.ownFileKinds ?? [];
  for (const kind of kinds) {
    if (!KIND_GROUPS.some((g) => g.kind === kind)) {
      throw new Error(
        `Unknown symbol kind "${String(kind)}" in ownFileKinds (expected: ${KIND_GROUPS.map((g) => g.kind).join(', ')})`
      );
    }
  }
  return new Set(kinds);
}

function makeContext(symbol: ApiSymbol, options: ApiMarkdownOptions, onOwnPage: boolean): Context {
  return {
    ownFileKinds: ownFileKinds(options),
    categoryOrder: options.categoryOrder ?? [],
    indexFile: options.indexFile ?? 'README.md',
    onOwnPage,
    symbol,
  };
}

function orderCategories(categories: string[], order: string[]): string[] {
  const listed = order.filter((c) => c !== '*' && categories.includes(c));
  const rest = categories.filter((c) => !order.includes(c)).sort();
  const star = order.indexOf('*');
  if (star < 0) return [...listed, ...rest];
  const before = order.slice(0, star).filter((c) => categories.includes(c));
  const after = order.slice(star + 1).filter((c) => categories.includes(c));
  return [...before, ...rest, ...after];
}

/**
 * Render the index page of an API: symbols grouped by kind (and by `@category`).
 *
 * Symbols of `ownFileKinds` are listed as links to `<kindDir>/<name>.md`;
 * the others are written in full. Records keep the order of the datasource.
 *
 * @param records - Records of a `typescript` datasource
 * @param options - Rendering options
 * @returns Markdown
 */
export function renderApiIndex(records: QueryResult, options: ApiMarkdownOptions = {}): string {
  const symbols = records.map(toSymbol);
  const level = options.headingLevel ?? 2;
  const ownFile = ownFileKinds(options);
  const out: string[] = [];

  for (const group of KIND_GROUPS) {
    const inGroup = symbols.filter((s) => s.kind === group.kind);
    if (inGroup.length === 0) continue;
    out.push(heading(level, group.title));

    const categorized = inGroup.some((s) => s.category !== null);
    const categories = categorized
      ? orderCategories([...new Set(inGroup.map((s) => s.category ?? DEFAULT_CATEGORY))], options.categoryOrder ?? [])
      : [null];

    for (const category of categories) {
      const symbolLevel = category === null ? level + 1 : level + 2;
      if (category !== null) out.push(heading(level + 1, escapeMarkdown(category)));
      const list = category === null ? inGroup : inGroup.filter((s) => (s.category ?? DEFAULT_CATEGORY) === category);
      if (ownFile.has(group.kind)) {
        out.push(list.map((s) => `- [${escapeMarkdown(s.name)}](${s.kindDir}/${s.name}.md)`).join('\n'));
        continue;
      }
      list.forEach((s, i) => {
        if (i > 0) out.push('***');
        const ctx = makeContext(s, options, false);
        out.push(heading(symbolLevel, symbolTitle(s, false)), ...symbolBody(ctx, symbolLevel + 1));
      });
    }
  }
  return out.join('\n\n') + '\n';
}

/**
 * Render the page of one symbol (for `<kindDir>/<name>.md`).
 *
 * @param record - One record of a `typescript` datasource
 * @param options - Rendering options; `ownFileKinds` and `indexFile` decide the links to other symbols
 * @returns Markdown
 */
export function renderApiPage(record: Record<string, unknown>, options: ApiMarkdownOptions = {}): string {
  const symbol = toSymbol(record);
  const ctx = makeContext(symbol, options, true);
  const breadcrumb = `[API](../${ctx.indexFile}) / ${escapeMarkdown(symbol.name)}`;
  const title = heading(1, `${symbol.kindLabel}: ${symbolTitle(symbol, true)}`);
  return [breadcrumb, title, ...symbolBody(ctx, 2)].join('\n\n') + '\n';
}
