/**
 * API Markdown Helper
 * Render records of the `typescript` datasource (ApiSymbol) as Markdown.
 */

import type {
  ApiLinkTarget,
  ApiMember,
  ApiSignature,
  ApiSource,
  ApiSymbol,
  ApiSymbolKind,
  ApiTag,
  ApiTypeParameter,
  QueryResult,
} from '../types/index.js';
import { INLINE_LINK, splitTypeText } from '../datasources/typescript.js';

/**
 * Options for {@link renderApiIndex} and {@link renderApiPage}.
 */
export interface ApiMarkdownOptions {
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

/** Tags a table cell shows in their own way. */
const CELL_TAGS = new Set(['example', 'deprecated', 'see', 'default', 'defaultValue', 'internal', 'category']);

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

/** Text for a table cell: on one line (blank lines become `<br><br>`). */
function cell(text: string): string {
  return text
    .replace(/\r?\n\s*\r?\n/g, '<br><br>')
    .replace(/\s*\r?\n\s*/g, ' ')
    .trim();
}

/**
 * A table row. Every table is written through here: an unescaped `|` in any
 * cell (in code spans too, which GitHub also splits on) is escaped, so a row
 * always has as many columns as its header.
 */
function tableRow(cells: string[]): string {
  return `| ${cells.map((c) => c.replace(/(?<!\\)\|/g, '\\|')).join(' | ')} |`;
}

/** A table: header row, separator, rows. */
function table(header: string[], rows: string[][]): string {
  return [tableRow(header), tableRow(header.map(() => '------')), ...rows.map(tableRow)].join('\n');
}

/** Link to an exported symbol: its page, or its heading on the index. */
function linkPath(ctx: Context, link: Pick<ApiLinkTarget, 'name' | 'page' | 'member'>): string {
  if (link.page !== null) {
    const path = ctx.onOwnPage ? `../${link.page}` : link.page;
    return link.member ? `${path}#${anchor(link.member)}` : path;
  }
  const target = `#${anchor(link.name)}`;
  return ctx.onOwnPage ? `../${ctx.indexFile}${target}` : target;
}

/** Replace `{@link ...}` with Markdown links (or code when the target is not an exported symbol). */
function resolveText(ctx: Context, text: string): string {
  return text.replace(INLINE_LINK, (_match, target: string, label: string) => {
    const shown = label.trim() || target;
    const link = ctx.symbol.links.find((l) => l.target === target);
    if (!link) return code(shown);
    return `[${code(shown)}](${linkPath(ctx, link)})`;
  });
}

/**
 * A type as inline code, with the names of exported symbols linked to them
 * (`[`Column`](../interfaces/Column.md)` + `` `<V>` ``).
 */
function typeCode(ctx: Context, type: string): string {
  const out: string[] = [];
  let pending = '';
  const flush = () => {
    if (pending.trim() !== '') out.push(code(pending));
    else if (pending !== '') out.push(' ');
    pending = '';
  };
  for (const part of splitTypeText(type)) {
    const link = part.identifier ? ctx.symbol.links.find((l) => l.target === part.text) : undefined;
    if (!link || link.name === ctx.symbol.name) {
      pending += part.text;
      continue;
    }
    flush();
    out.push(`[${code(part.text)}](${linkPath(ctx, link)})`);
  }
  flush();
  return out.join('');
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

/** An `@example` on one line: its title, then each code line as inline code. */
function inlineExample(text: string): string {
  const out: string[] = [];
  let inCode = false;
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inCode = !inCode;
      continue;
    }
    if (line.trim() === '') continue;
    out.push(inCode ? code(line) : line.trim());
  }
  return out.join(' ');
}

/**
 * Description in a table cell: everything the documentation says, on one line
 * (deprecation, summary, other tags, default, examples, see-also).
 */
function cellDescription(ctx: Context, summary: string, tags: ApiTag[]): string {
  const parts: string[] = [];
  for (const t of tagsNamed(tags, 'deprecated')) parts.push(`**Deprecated**${t.text ? ` ${t.text}` : ''}`);
  if (summary) parts.push(summary);
  for (const t of tags) {
    if (CELL_TAGS.has(t.tag)) continue;
    parts.push(`**${t.tag.charAt(0).toUpperCase() + t.tag.slice(1)}**${t.text ? ` ${t.text}` : ''}`);
  }
  for (const t of [...tagsNamed(tags, 'default'), ...tagsNamed(tags, 'defaultValue')]) {
    parts.push(`**Default** ${code(t.text)}`);
  }
  const examples = tagsNamed(tags, 'example');
  if (examples.length > 0) {
    parts.push(`**${examples.length > 1 ? 'Examples' : 'Example'}** ${examples.map((t) => inlineExample(t.text)).join(' ')}`);
  }
  for (const t of tagsNamed(tags, 'see')) parts.push(`**See** ${t.text}`);
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
    return cols;
  });
  const header = withDescription ? ['Type Parameter', 'Description'] : ['Type Parameter'];
  return [heading(level, 'Type Parameters'), table(header, rows)];
}

function signatureBlocks(ctx: Context, sig: ApiSignature, level: number): string[] {
  const out: string[] = [codeBlock(sig.code), definedIn(sig.source)];
  out.push(...docBlocks(ctx, sig.summary, sig.tags, level));
  out.push(...typeParameterTable(ctx, sig.typeParameters, level));
  if (sig.parameters.length > 0) {
    // A default value is written in the description column, so it needs the column too.
    const withDescription = sig.parameters.some((p) => p.description || p.defaultValue !== null);
    const header = withDescription ? ['Parameter', 'Type', 'Description'] : ['Parameter', 'Type'];
    const rows = sig.parameters.map((p) => {
      const name = `${p.rest ? '...' : ''}${p.name}${p.optional && !p.rest ? '?' : ''}`;
      const cols = [code(name), typeCode(ctx, p.type)];
      if (withDescription) {
        let description = resolveText(ctx, p.description);
        if (p.defaultValue !== null) description += `${description ? ' ' : ''}**Default** ${code(p.defaultValue)}`;
        cols.push(cell(description));
      }
      return cols;
    });
    out.push(heading(level, 'Parameters'), table(header, rows));
  }
  if (sig.returns) {
    out.push(heading(level, 'Returns'), typeCode(ctx, sig.returns.type));
    if (sig.returns.description) out.push(resolveText(ctx, sig.returns.description));
  }
  return out;
}

/**
 * Heading of a member: its plain name, so its anchor is the name (`#find`),
 * which is what links use. `static` / `abstract` show in the signature code.
 */
function memberTitle(member: ApiMember): string {
  const name = member.kind === 'method' ? `${member.name}()` : member.name;
  return escapeMarkdown(name);
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
        ? ['Member', 'Value', 'Description', 'Defined in']
        : [group.kind === 'index-signature' ? 'Index' : 'Property', 'Type', 'Description', 'Defined in'];
      const rows = list.map((m) => {
        const flags = [
          m.static ? 'static' : '',
          m.abstract ? 'abstract' : '',
          m.readonly && !isEnum ? 'readonly' : '',
          m.protected ? 'protected' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const name = `<a id="${anchor(m.name)}"></a> ${code(`${m.name}${m.optional ? '?' : ''}`)}${flags ? ` (${flags})` : ''}`;
        const source = m.source.url ? `[${m.source.file}:${m.source.line}](${m.source.url})` : `${m.source.file}:${m.source.line}`;
        const type = m.type === null ? '' : isEnum ? code(m.type) : typeCode(ctx, m.type);
        return [name, type, cellDescription(ctx, m.summary, m.tags), source];
      });
      out.push(table(header, rows));
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
      ? `[${escapeMarkdown(s.referenceOf)}](${linkPath(ctx, { ...link, member: null })})`
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
  if (s.extends.length > 0) {
    out.push(heading(level, 'Extends'), s.extends.map((t) => `- ${typeCode(ctx, t)}`).join('\n'));
  }
  if (s.implements.length > 0) {
    out.push(heading(level, 'Implements'), s.implements.map((t) => `- ${typeCode(ctx, t)}`).join('\n'));
  }
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

function makeContext(symbol: ApiSymbol, options: ApiMarkdownOptions, onOwnPage: boolean): Context {
  return {
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
 * Symbols with a page (the datasource's `pages`) are listed as links to it;
 * the others are written in full. Records keep the order of the datasource.
 *
 * @param records - Records of a `typescript` datasource
 * @param options - Rendering options
 * @returns Markdown
 */
export function renderApiIndex(records: QueryResult, options: ApiMarkdownOptions = {}): string {
  const symbols = records.map(toSymbol);
  const level = options.headingLevel ?? 2;
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
      const withPage = list.filter((s) => s.page !== null);
      if (withPage.length > 0) {
        out.push(withPage.map((s) => `- [${escapeMarkdown(s.name)}](${s.page})`).join('\n'));
      }
      list.filter((s) => s.page === null).forEach((s, i) => {
        if (i > 0) out.push('***');
        const ctx = makeContext(s, options, false);
        out.push(heading(symbolLevel, symbolTitle(s, false)), ...symbolBody(ctx, symbolLevel + 1));
      });
    }
  }
  return out.join('\n\n') + '\n';
}

/**
 * Render the page of one symbol (its `page`, `<kindDir>/<name>.md`).
 *
 * @param record - One record of a `typescript` datasource
 * @param options - Rendering options; `indexFile` is used for links to symbols written on the index
 * @returns Markdown
 */
export function renderApiPage(record: Record<string, unknown>, options: ApiMarkdownOptions = {}): string {
  const symbol = toSymbol(record);
  const ctx = makeContext(symbol, options, true);
  const breadcrumb = `[API](../${ctx.indexFile}) / ${escapeMarkdown(symbol.name)}`;
  const kind = symbol.abstract ? `Abstract ${symbol.kindLabel}` : symbol.kindLabel;
  const title = heading(1, `${kind}: ${symbolTitle(symbol, true)}`);
  return [breadcrumb, title, ...symbolBody(ctx, 2)].join('\n\n') + '\n';
}
