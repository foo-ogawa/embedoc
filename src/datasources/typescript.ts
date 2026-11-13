/**
 * TypeScript Datasource
 * Public API of TypeScript entry points, read with the TypeScript compiler API.
 * One record per exported symbol (see ApiSymbol).
 */

import { dirname, relative, resolve, sep } from 'node:path';
import type * as TS from 'typescript';
import type {
  ApiLinkTarget,
  ApiMember,
  ApiParameter,
  ApiSignature,
  ApiSource,
  ApiSymbol,
  ApiSymbolKind,
  ApiTag,
  ApiTypeParameter,
  Datasource,
  DatasourceConfig,
  QueryResult,
  TypeScriptDatasourceConfig,
} from '../types/index.js';
import { filterRows } from './filter.js';

type TypeScript = typeof TS;

const SUPPORTED_TYPESCRIPT = '>=5.0.0 <7.0.0';

const KIND_INFO: Record<ApiSymbolKind, { label: string; dir: string }> = {
  namespace: { label: 'Namespace', dir: 'namespaces' },
  enum: { label: 'Enumeration', dir: 'enumerations' },
  class: { label: 'Class', dir: 'classes' },
  interface: { label: 'Interface', dir: 'interfaces' },
  type: { label: 'Type Alias', dir: 'type-aliases' },
  variable: { label: 'Variable', dir: 'variables' },
  function: { label: 'Function', dir: 'functions' },
  reference: { label: 'Reference', dir: 'references' },
};

/** Tags that always hide a symbol or member. */
const HIDDEN_TAGS = new Set(['hidden', 'ignore']);

/** A documentation comment split into its parts. */
interface ParsedDoc {
  summary: string;
  /** Block tags other than the ones below, in source order. */
  tags: ApiTag[];
  /** `@param name description` */
  parameters: Map<string, string>;
  /** `@template T description` */
  typeParameters: Map<string, string>;
  /** `@returns description` */
  returns: string;
}

const EMPTY_DOC: ParsedDoc = {
  summary: '',
  tags: [],
  parameters: new Map(),
  typeParameters: new Map(),
  returns: '',
};

/** Trim blank lines around a block and the indentation all its lines share. */
function trimBlock(lines: string[]): string {
  while (lines.length > 0 && lines[0]!.trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop();
  return lines.join('\n');
}

/**
 * Positions of block tags (`@name` at the start of the line or after
 * whitespace) outside inline code spans.
 */
function blockTagPositions(line: string): number[] {
  const positions: number[] = [];
  let span = 0; // length of the backtick run that opened the current code span
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '`') {
      let run = 1;
      while (line[i + run] === '`') run++;
      if (span === 0) span = run;
      else if (run === span) span = 0;
      i += run - 1;
      continue;
    }
    if (
      span === 0 &&
      line[i] === '@' &&
      (i === 0 || /\s/.test(line[i - 1]!)) &&
      /[A-Za-z]/.test(line[i + 1] ?? '')
    ) {
      positions.push(i);
    }
  }
  return positions;
}

/**
 * Parse a `/** ... *\/` comment. A block tag is `@name` at the start of a line
 * or after whitespace, outside fenced code and inline code, so `@decorator`
 * lines in an example are code, not tags (the compiler's own JSDoc parser
 * takes them for tags). Indentation inside the comment is kept.
 */
export function parseDocComment(raw: string): ParsedDoc {
  const body = raw.replace(/^\/\*\*/, '').replace(/\*\/$/, '');
  const lines = body.split(/\r?\n/).map((line, i) => {
    if (i === 0) return line.trim();
    return line.replace(/^\s*\*(?: |(?=\S)|$)/, '').replace(/\s+$/, '');
  });

  const blocks: { tag: string | null; lines: string[] }[] = [{ tag: null, lines: [] }];
  let fence: string | null = null;
  for (const line of lines) {
    const fenceMatch = /^\s*(```+|~~~+)/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1]!;
      if (fence === null) fence = marker[0]!.repeat(marker.length);
      else if (marker.startsWith(fence)) fence = null;
    }
    const positions = fence === null && !fenceMatch ? blockTagPositions(line) : [];
    if (positions.length === 0) {
      blocks[blocks.length - 1]!.lines.push(line);
      continue;
    }
    const before = line.slice(0, positions[0]).replace(/\s+$/, '');
    if (before !== '') blocks[blocks.length - 1]!.lines.push(before);
    positions.forEach((start, k) => {
      const segment = line.slice(start, positions[k + 1] ?? line.length).replace(/\s+$/, '');
      const m = /^@([A-Za-z][\w-]*)\s*([\s\S]*)$/.exec(segment)!;
      blocks.push({ tag: m[1]!, lines: [m[2]!] });
    });
  }

  const doc: ParsedDoc = {
    summary: trimBlock(blocks[0]!.lines),
    tags: [],
    parameters: new Map(),
    typeParameters: new Map(),
    returns: '',
  };
  for (const block of blocks.slice(1)) {
    const tag = block.tag!;
    const text = trimBlock(block.lines);
    if (tag === 'param' || tag === 'template' || tag === 'typeParam') {
      // `@param {type} [name=default] - description`
      const m = /^(?:\{[^}]*\}\s*)?\[?([\w$.]+)(?:=[^\]]*)?\]?\s*(?:-\s*)?([\s\S]*)$/.exec(text);
      if (m) {
        const map = tag === 'param' ? doc.parameters : doc.typeParameters;
        // A dotted name documents a property of a parameter, not the parameter.
        if (!m[1]!.includes('.') && !map.has(m[1]!)) map.set(m[1]!, m[2]!.trim());
      }
    } else if (tag === 'returns' || tag === 'return') {
      doc.returns = text.replace(/^\{[^}]*\}\s*/, '');
    } else {
      doc.tags.push({ tag, text });
    }
  }
  return doc;
}

/**
 * Load the `typescript` package (an optional peer dependency).
 */
async function loadTypeScript(): Promise<TypeScript> {
  let mod: unknown;
  try {
    mod = await import('typescript');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `The "typescript" datasource needs the "typescript" package (${SUPPORTED_TYPESCRIPT}). ` +
        `Install it in your project (npm install -D typescript). Cause: ${message}`,
      { cause: error }
    );
  }
  const ts = ((mod as { default?: unknown }).default ?? mod) as TypeScript;
  if (typeof ts.createProgram !== 'function') {
    throw new Error(
      `The "typescript" datasource needs the TypeScript compiler API (${SUPPORTED_TYPESCRIPT}); ` +
        `the installed "typescript" package does not provide it.`
    );
  }
  return ts;
}

function toPosix(p: string): string {
  return p.split(sep).join('/');
}

function commonDirectory(files: string[]): string {
  const parts = files.map((f) => dirname(f).split(sep));
  const first = parts[0] ?? [];
  let length = first.length;
  for (const p of parts) {
    let i = 0;
    while (i < length && i < p.length && p[i] === first[i]) i++;
    length = i;
  }
  return first.slice(0, length).join(sep) || sep;
}

/** `{@link Target}`, `{@link Target|text}`, `{@link Target text}` (also linkcode / linkplain). */
export const INLINE_LINK = /\{@link(?:code|plain)?\s+([^}|\s]+)(?:\s*\|\s*|\s+)?([^}]*)\}/g;

/**
 * Record on each symbol which `{@link ...}` targets in its documentation name an
 * exported symbol of the same datasource, so a renderer of one record can link them.
 */
function resolveLinks(records: ApiSymbol[]): void {
  const byName = new Map(records.map((r) => [r.name, r]));
  for (const record of records) {
    const texts: string[] = [];
    const collect = (summary: string, tags: ApiTag[]) => {
      texts.push(summary, ...tags.map((t) => t.text));
    };
    const collectSignature = (sig: ApiSignature) => {
      collect(sig.summary, sig.tags);
      texts.push(...sig.parameters.map((p) => p.description));
      if (sig.returns) texts.push(sig.returns.description);
    };
    collect(record.summary, record.tags);
    record.signatures.forEach(collectSignature);
    for (const member of record.members) {
      collect(member.summary, member.tags);
      member.signatures.forEach(collectSignature);
    }
    const found = new Map<string, ApiLinkTarget>();
    const targets: string[] = record.referenceOf ? [record.referenceOf] : [];
    for (const text of texts) {
      for (const match of text.matchAll(INLINE_LINK)) targets.push(match[1]!);
    }
    for (const target of targets) {
      if (found.has(target)) continue;
      const [name, ...rest] = target.split(/[.#]/);
      const symbol = byName.get(name ?? '');
      if (!symbol) continue;
      found.set(target, {
        target,
        name: symbol.name,
        kind: symbol.kind,
        kindDir: symbol.kindDir,
        member: rest.length > 0 ? rest.join('.') : null,
      });
    }
    record.links = [...found.values()];
  }
}

/** Order of UTF-16 code units (so `Middleware.ts` comes before `decorators.ts`). */
function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Case-insensitive order, then code units to break ties. */
function compareText(a: string, b: string): number {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la !== lb) return la < lb ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

interface ExtractOptions {
  excludeInternal: boolean;
  excludePrivate: boolean;
  excludeExternals: boolean;
  sourceLinkTemplate: string | null;
  gitRevision: string | null;
  sort: 'source-order' | 'alphabetical';
  baseDir: string;
  displayDir: string;
}

/**
 * Reads exported symbols with one program and type checker.
 */
class ApiExtractor {
  private readonly typeFlags: TS.TypeFormatFlags;

  constructor(
    private readonly ts: TypeScript,
    private readonly program: TS.Program,
    private readonly checker: TS.TypeChecker,
    private readonly options: ExtractOptions
  ) {
    this.typeFlags =
      ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;
  }

  extract(entryFiles: string[]): ApiSymbol[] {
    const { ts, checker } = this;
    // Every exported name of each symbol, in export order.
    const exportsOf = new Map<TS.Symbol, TS.Symbol[]>();

    for (const file of entryFiles) {
      const sourceFile = this.program.getSourceFile(file);
      if (!sourceFile) {
        throw new Error(`TypeScript entry point not found in the program: ${file}`);
      }
      const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
      if (!moduleSymbol) {
        continue; // A file without exports has no public API.
      }
      for (const exported of checker.getExportsOfModule(moduleSymbol)) {
        const target =
          exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
        const names = exportsOf.get(target) ?? [];
        if (!names.some((n) => n.name === exported.name)) names.push(exported);
        exportsOf.set(target, names);
      }
    }

    const symbols: { symbol: ApiSymbol; position: [string, number] }[] = [];
    for (const [target, exported] of exportsOf) {
      // The symbol is documented under its own name when that name is exported;
      // every other exported name is a reference to it.
      const primary = exported.find((e) => e.name === target.name) ?? exported[0]!;
      const built = this.buildSymbol(primary.name, target);
      if (!built) continue;
      symbols.push(built);
      for (const alias of exported) {
        if (alias === primary) continue;
        const reference = this.buildReference(alias, built.symbol);
        if (reference) symbols.push(reference);
      }
    }

    symbols.sort((a, b) => {
      if (this.options.sort === 'source-order') {
        const byPath = compareCodeUnits(a.position[0], b.position[0]);
        if (byPath !== 0) return byPath;
        if (a.position[1] !== b.position[1]) return a.position[1] - b.position[1];
      }
      return compareText(a.symbol.name, b.symbol.name);
    });
    const records = symbols.map((s) => s.symbol);
    resolveLinks(records);
    return records;
  }

  /** A second exported name of a symbol (`export { A as B }`). */
  private buildReference(
    alias: TS.Symbol,
    of: ApiSymbol
  ): { symbol: ApiSymbol; position: [string, number] } | null {
    const declaration = alias.declarations?.[0];
    if (!declaration) return null;
    const doc = this.docOf(declaration);
    if (this.isHidden(doc.tags)) return null;
    const sf = declaration.getSourceFile();
    return {
      symbol: {
        name: alias.name,
        kind: 'reference',
        kindLabel: KIND_INFO.reference.label,
        kindDir: KIND_INFO.reference.dir,
        category: null,
        summary: doc.summary,
        tags: doc.tags,
        code: null,
        typeParameters: [],
        extends: [],
        implements: [],
        signatures: [],
        members: [],
        source: this.sourceOf(declaration),
        referenceOf: of.name,
        links: [],
      },
      position: [toPosix(relative(this.options.baseDir, sf.fileName)), this.nameNode(declaration).getStart()],
    };
  }

  private buildSymbol(
    name: string,
    symbol: TS.Symbol
  ): { symbol: ApiSymbol; position: [string, number] } | null {
    const { ts } = this;
    const declarations = (symbol.declarations ?? []).filter((d) => !this.isExcludedFile(d));
    const declaration = this.primaryDeclaration(declarations);
    if (!declaration) return null;

    const kind = this.kindOf(declaration);
    if (!kind) return null;

    const doc = this.docOf(declaration);
    if (this.isHidden(doc.tags)) return null;

    const categoryTag = doc.tags.find((t) => t.tag === 'category');
    const record: ApiSymbol = {
      name,
      kind,
      kindLabel: KIND_INFO[kind].label,
      kindDir: KIND_INFO[kind].dir,
      category: categoryTag ? categoryTag.text.trim() || null : null,
      summary: doc.summary,
      tags: doc.tags,
      code: null,
      typeParameters: [],
      extends: [],
      implements: [],
      signatures: [],
      members: [],
      source: this.sourceOf(declaration),
      referenceOf: null,
      links: [],
    };

    if (ts.isClassDeclaration(declaration)) {
      record.typeParameters = this.typeParameters(declaration.typeParameters, doc);
      this.heritage(declaration, record);
      record.members = this.members(declaration.members, name);
    } else if (ts.isInterfaceDeclaration(declaration)) {
      record.typeParameters = this.typeParameters(declaration.typeParameters, doc);
      const interfaces = declarations.filter(ts.isInterfaceDeclaration);
      for (const d of interfaces) this.heritage(d, record);
      record.members = interfaces.flatMap((d) => this.members(d.members, name));
    } else if (ts.isEnumDeclaration(declaration)) {
      record.members = declarations
        .filter(ts.isEnumDeclaration)
        .flatMap((d) => d.members.map((m) => this.enumMember(m)))
        .filter((m): m is ApiMember => m !== null);
    } else if (ts.isTypeAliasDeclaration(declaration)) {
      record.typeParameters = this.typeParameters(declaration.typeParameters, doc);
      const params = this.typeParameterList(declaration.typeParameters);
      record.code = `type ${name}${params} = ${declaration.type.getText()};`;
      if (ts.isTypeLiteralNode(declaration.type)) {
        record.members = this.members(declaration.type.members, name);
      }
    } else if (kind === 'function') {
      record.signatures = this.functionSignatures(name, symbol, declaration);
    } else if (ts.isVariableDeclaration(declaration)) {
      const isConst = (ts.getCombinedNodeFlags(declaration) & ts.NodeFlags.Const) !== 0;
      const type = declaration.type
        ? declaration.type.getText()
        : this.checker.typeToString(
            this.checker.getTypeAtLocation(declaration.name),
            undefined,
            this.typeFlags
          );
      record.code = `${isConst ? 'const' : 'let'} ${name}: ${type};`;
      record.members = this.variableMembers(declaration);
    }

    const sf = declaration.getSourceFile();
    return {
      symbol: record,
      position: [toPosix(relative(this.options.baseDir, sf.fileName)), this.nameNode(declaration).getStart()],
    };
  }

  private isExcludedFile(node: TS.Node): boolean {
    if (!this.options.excludeExternals) return false;
    const sf = node.getSourceFile();
    return (
      this.program.isSourceFileFromExternalLibrary(sf) ||
      this.program.isSourceFileDefaultLibrary(sf) ||
      toPosix(sf.fileName).includes('/node_modules/')
    );
  }

  private primaryDeclaration(declarations: TS.Declaration[]): TS.Declaration | undefined {
    const { ts } = this;
    const order: ((d: TS.Declaration) => boolean)[] = [
      ts.isClassDeclaration,
      ts.isInterfaceDeclaration,
      ts.isEnumDeclaration,
      ts.isTypeAliasDeclaration,
      ts.isFunctionDeclaration,
      ts.isVariableDeclaration,
      ts.isModuleDeclaration,
    ];
    for (const test of order) {
      const found = declarations.find(test);
      if (found) return found;
    }
    return undefined;
  }

  private kindOf(declaration: TS.Declaration): ApiSymbolKind | null {
    const { ts } = this;
    if (ts.isClassDeclaration(declaration)) return 'class';
    if (ts.isInterfaceDeclaration(declaration)) return 'interface';
    if (ts.isEnumDeclaration(declaration)) return 'enum';
    if (ts.isTypeAliasDeclaration(declaration)) return 'type';
    if (ts.isFunctionDeclaration(declaration)) return 'function';
    if (ts.isModuleDeclaration(declaration)) return 'namespace';
    if (ts.isVariableDeclaration(declaration)) {
      const init = declaration.initializer;
      const functionLike =
        init !== undefined && (ts.isArrowFunction(init) || ts.isFunctionExpression(init));
      // A variable initialized with a function and no type annotation is a function.
      return functionLike && !declaration.type ? 'function' : 'variable';
    }
    return null;
  }

  private nameNode(node: TS.Node): TS.Node {
    const name = (node as { name?: TS.Node }).name;
    return name ?? node;
  }

  private sourceOf(node: TS.Node): ApiSource {
    const sf = node.getSourceFile();
    const line = sf.getLineAndCharacterOfPosition(this.nameNode(node).getStart()).line + 1;
    const path = toPosix(relative(this.options.baseDir, sf.fileName));
    const file = toPosix(relative(this.options.displayDir, sf.fileName));
    let url: string | null = null;
    const template = this.options.sourceLinkTemplate;
    if (template) {
      url = template
        .replace(/\{gitRevision\}/g, this.options.gitRevision ?? '')
        .replace(/\{path\}/g, path)
        .replace(/\{line\}/g, String(line));
    }
    return { file, path, line, url };
  }

  /** The documentation comment closest to a declaration. */
  private docOf(node: TS.Node): ParsedDoc {
    const { ts } = this;
    const docs = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc);
    const doc = docs[docs.length - 1];
    if (!doc) return EMPTY_DOC;
    return parseDocComment(doc.getSourceFile().text.slice(doc.pos, doc.end));
  }

  private isHidden(tags: ApiTag[]): boolean {
    return tags.some(
      (t) => HIDDEN_TAGS.has(t.tag) || (this.options.excludeInternal && t.tag === 'internal')
    );
  }

  private typeText(node: TS.TypeNode | undefined, fallback: () => TS.Type): string {
    if (node) return node.getText();
    return this.checker.typeToString(fallback(), undefined, this.typeFlags);
  }

  private typeParameterList(params: TS.NodeArray<TS.TypeParameterDeclaration> | undefined): string {
    if (!params || params.length === 0) return '';
    return `<${params.map((p) => p.getText()).join(', ')}>`;
  }

  private typeParameters(
    params: TS.NodeArray<TS.TypeParameterDeclaration> | undefined,
    doc: ParsedDoc
  ): ApiTypeParameter[] {
    if (!params) return [];
    return params.map((p) => ({
      name: p.name.text,
      constraint: p.constraint ? p.constraint.getText() : null,
      default: p.default ? p.default.getText() : null,
      description: doc.typeParameters.get(p.name.text) ?? '',
    }));
  }

  private heritage(node: TS.ClassDeclaration | TS.InterfaceDeclaration, record: ApiSymbol): void {
    const { ts } = this;
    for (const clause of node.heritageClauses ?? []) {
      const types = clause.types.map((t) => t.getText());
      if (clause.token === ts.SyntaxKind.ExtendsKeyword) record.extends.push(...types);
      else record.implements.push(...types);
    }
  }

  private parameters(params: TS.NodeArray<TS.ParameterDeclaration>, doc: ParsedDoc): ApiParameter[] {
    const { ts } = this;
    return params
      .filter((p) => !(ts.isIdentifier(p.name) && p.name.text === 'this'))
      .map((p) => ({
        name: p.name.getText(),
        type: this.typeText(p.type, () => this.checker.getTypeAtLocation(p)),
        optional: p.questionToken !== undefined || p.initializer !== undefined,
        rest: p.dotDotDotToken !== undefined,
        defaultValue: p.initializer ? p.initializer.getText() : null,
        description: ts.isIdentifier(p.name) ? (doc.parameters.get(p.name.text) ?? '') : '',
      }));
  }

  private parameterCode(params: ApiParameter[]): string {
    return params
      .map((p) => `${p.rest ? '...' : ''}${p.name}${p.optional && !p.rest ? '?' : ''}: ${p.type}`)
      .join(', ');
  }

  private returnsOf(declaration: TS.SignatureDeclaration, signature: TS.Signature | undefined, doc: ParsedDoc) {
    const type = declaration.type
      ? declaration.type.getText()
      : signature
        ? this.checker.typeToString(this.checker.getReturnTypeOfSignature(signature), undefined, this.typeFlags)
        : 'void';
    return { type, description: doc.returns };
  }

  /**
   * Build a signature record. `prefix` is the code before the type parameters,
   * e.g. `function name`, `static name`, `new Name`, `get name`.
   * A construct signature names the constructed type in `constructs`.
   * `docNode` carries the comment (the variable of `const f = () => ...`).
   */
  private signature(
    declaration: TS.SignatureDeclaration,
    prefix: string,
    kind: 'call' | 'construct' | 'get' | 'set',
    constructs = '',
    docNode: TS.Node = declaration
  ): ApiSignature {
    const doc = this.docOf(docNode);
    const parameters = this.parameters(declaration.parameters, doc);
    const typeParameters = this.typeParameters(declaration.typeParameters, doc);
    const tsSignature = this.checker.getSignatureFromDeclaration(declaration);
    let returns: ApiSignature['returns'] = null;
    let suffix = '';
    if (kind === 'construct') {
      suffix = `: ${constructs}`;
    } else if (kind !== 'set') {
      returns = this.returnsOf(declaration, tsSignature, doc);
      suffix = `: ${returns.type}`;
    }
    const typeParamCode = this.typeParameterList(declaration.typeParameters);
    return {
      code: `${prefix}${typeParamCode}(${this.parameterCode(parameters)})${suffix};`,
      summary: doc.summary,
      tags: doc.tags,
      typeParameters,
      parameters,
      returns,
      source: this.sourceOf(docNode),
    };
  }

  /** Overload declarations, or the implementation when there are no overloads. */
  private publicOverloads<T extends TS.FunctionLikeDeclaration | TS.SignatureDeclaration>(
    declarations: T[]
  ): T[] {
    const withoutBody = declarations.filter((d) => !('body' in d) || d.body === undefined);
    return withoutBody.length > 0 ? withoutBody : declarations;
  }

  private functionSignatures(
    name: string,
    symbol: TS.Symbol,
    declaration: TS.Declaration
  ): ApiSignature[] {
    const { ts } = this;
    if (ts.isVariableDeclaration(declaration)) {
      const init = declaration.initializer;
      if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
        // The doc comment of `export const f = () => ...` is on the variable statement.
        return [this.signature(init, `function ${name}`, 'call', '', declaration)];
      }
      return [];
    }
    const functions = (symbol.declarations ?? []).filter(ts.isFunctionDeclaration);
    return this.publicOverloads(functions).map((d) => this.signature(d, `function ${name}`, 'call'));
  }

  private modifiers(node: TS.Node): Set<TS.SyntaxKind> {
    const { ts } = this;
    const mods = ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []) : [];
    return new Set(mods.map((m) => m.kind));
  }

  private isPrivate(node: TS.Node, mods: Set<TS.SyntaxKind>): boolean {
    const name = (node as { name?: TS.Node }).name;
    return mods.has(this.ts.SyntaxKind.PrivateKeyword) || (name !== undefined && this.ts.isPrivateIdentifier(name));
  }

  private members(elements: TS.NodeArray<TS.ClassElement | TS.TypeElement>, ownerName: string): ApiMember[] {
    const { ts } = this;
    const groups = new Map<string, (TS.ClassElement | TS.TypeElement)[]>();
    const order: string[] = [];
    for (const element of elements) {
      if (ts.isClassStaticBlockDeclaration(element) || ts.isSemicolonClassElement(element)) continue;
      const mods = this.modifiers(element);
      if (this.options.excludePrivate && this.isPrivate(element, mods)) continue;
      let key: string;
      if (ts.isConstructorDeclaration(element) || ts.isConstructSignatureDeclaration(element)) key = 'constructor';
      else if (ts.isCallSignatureDeclaration(element)) key = '()';
      else if (ts.isIndexSignatureDeclaration(element)) key = `[${element.parameters.map((p) => p.getText()).join(', ')}]`;
      else {
        const name = element.name ? element.name.getText() : '';
        key = `${mods.has(ts.SyntaxKind.StaticKeyword) ? 'static ' : ''}${name}`;
      }
      if (!groups.has(key)) {
        groups.set(key, []);
        order.push(key);
      }
      groups.get(key)!.push(element);
    }

    const members: ApiMember[] = [];
    for (const key of order) {
      const member = this.member(groups.get(key)!, ownerName);
      if (member) members.push(member);
      if (key === 'constructor') members.push(...this.parameterProperties(groups.get(key)!));
    }
    if (this.options.sort === 'alphabetical') {
      members.sort((a, b) => compareText(a.name, b.name));
    }
    return members;
  }

  private member(elements: (TS.ClassElement | TS.TypeElement)[], ownerName: string): ApiMember | null {
    const { ts } = this;
    const first = elements[0]!;
    const doc = this.docOf(first);
    if (this.isHidden(doc.tags)) return null;
    const mods = this.modifiers(first);
    const isStatic = mods.has(ts.SyntaxKind.StaticKeyword);
    const isAbstract = mods.has(ts.SyntaxKind.AbstractKeyword);
    // Modifiers shown in the signature code (headings use the plain name).
    const staticPrefix = `${isStatic ? 'static ' : ''}${isAbstract ? 'abstract ' : ''}`;
    const base = {
      static: isStatic,
      readonly: mods.has(ts.SyntaxKind.ReadonlyKeyword),
      optional: (first as { questionToken?: TS.Node }).questionToken !== undefined,
      protected: mods.has(ts.SyntaxKind.ProtectedKeyword),
      abstract: isAbstract,
      summary: doc.summary,
      tags: doc.tags,
      source: this.sourceOf(first),
    };

    if (ts.isConstructorDeclaration(first) || ts.isConstructSignatureDeclaration(first)) {
      const decls = this.publicOverloads(elements as (TS.ConstructorDeclaration | TS.ConstructSignatureDeclaration)[]);
      const owner = `${ownerName}${this.ownerTypeArguments(first)}`;
      return {
        ...base,
        name: 'constructor',
        kind: 'constructor',
        type: null,
        signatures: decls.map((d) => this.signature(d, `new ${ownerName}`, 'construct', owner)),
      };
    }
    if (ts.isCallSignatureDeclaration(first)) {
      return {
        ...base,
        name: '()',
        kind: 'call-signature',
        type: null,
        signatures: (elements as TS.CallSignatureDeclaration[]).map((d) => this.signature(d, '', 'call')),
      };
    }
    if (ts.isIndexSignatureDeclaration(first)) {
      const params = first.parameters.map((p) => p.getText()).join(', ');
      return {
        ...base,
        name: `[${params}]`,
        kind: 'index-signature',
        type: this.typeText(first.type, () => this.checker.getTypeAtLocation(first)),
        signatures: [],
      };
    }
    const name = first.name ? first.name.getText() : '';
    if (ts.isMethodDeclaration(first) || ts.isMethodSignature(first)) {
      const decls = this.publicOverloads(elements as (TS.MethodDeclaration | TS.MethodSignature)[]);
      return {
        ...base,
        name,
        kind: 'method',
        type: null,
        signatures: decls.map((d) => this.signature(d, `${staticPrefix}${name}`, 'call')),
      };
    }
    if (ts.isGetAccessorDeclaration(first) || ts.isSetAccessorDeclaration(first)) {
      const getters = elements.filter(ts.isGetAccessorDeclaration);
      const setters = elements.filter(ts.isSetAccessorDeclaration);
      return {
        ...base,
        name,
        kind: 'accessor',
        type: null,
        signatures: [
          ...getters.map((d) => this.signature(d, `${staticPrefix}get ${name}`, 'get')),
          ...setters.map((d) => this.signature(d, `${staticPrefix}set ${name}`, 'set')),
        ],
      };
    }
    if (ts.isPropertyDeclaration(first) || ts.isPropertySignature(first)) {
      return {
        ...base,
        name,
        kind: 'property',
        type: this.typeText(first.type, () => this.checker.getTypeAtLocation(first.name)),
        signatures: [],
      };
    }
    return null;
  }

  /**
   * Properties of the object literal or type literal part of a variable's type
   * (`const x = Object.assign(fn, { a, b })`), so they are documented with it.
   */
  private variableMembers(declaration: TS.VariableDeclaration): ApiMember[] {
    const { ts, checker } = this;
    const type = checker.getTypeAtLocation(declaration.name);
    const parts = type.isIntersection() ? type.types : [type];
    const members: ApiMember[] = [];
    for (const part of parts) {
      const owner = part.getSymbol();
      if (!owner || !(owner.flags & (ts.SymbolFlags.ObjectLiteral | ts.SymbolFlags.TypeLiteral))) continue;
      for (const property of checker.getPropertiesOfType(part)) {
        const decl = property.valueDeclaration ?? property.declarations?.[0];
        if (!decl) continue;
        const doc = this.docOf(decl);
        if (this.isHidden(doc.tags)) continue;
        members.push({
          name: property.name,
          kind: 'property',
          static: false,
          readonly: false,
          optional: (property.flags & ts.SymbolFlags.Optional) !== 0,
          protected: false,
          abstract: false,
          type: checker.typeToString(checker.getTypeOfSymbolAtLocation(property, declaration), undefined, this.typeFlags),
          summary: doc.summary,
          tags: doc.tags,
          signatures: [],
          source: this.sourceOf(decl),
        });
      }
    }
    if (this.options.sort === 'alphabetical') {
      members.sort((a, b) => compareText(a.name, b.name));
    }
    return members;
  }

  /**
   * Properties declared by constructor parameters (`constructor(public readonly x: T)`).
   * Their description is the constructor's `@param` text.
   */
  private parameterProperties(elements: (TS.ClassElement | TS.TypeElement)[]): ApiMember[] {
    const { ts } = this;
    const members: ApiMember[] = [];
    for (const ctor of elements) {
      if (!ts.isConstructorDeclaration(ctor)) continue;
      const doc = this.docOf(ctor);
      for (const param of ctor.parameters) {
        if (!ts.isParameterPropertyDeclaration(param, ctor) || !ts.isIdentifier(param.name)) continue;
        const mods = this.modifiers(param);
        if (this.options.excludePrivate && mods.has(ts.SyntaxKind.PrivateKeyword)) continue;
        members.push({
          name: param.name.text,
          kind: 'property',
          static: false,
          readonly: mods.has(ts.SyntaxKind.ReadonlyKeyword),
          optional: param.questionToken !== undefined || param.initializer !== undefined,
          protected: mods.has(ts.SyntaxKind.ProtectedKeyword),
          abstract: false,
          type: this.typeText(param.type, () => this.checker.getTypeAtLocation(param)),
          summary: doc.parameters.get(param.name.text) ?? '',
          tags: [],
          signatures: [],
          source: this.sourceOf(param),
        });
      }
    }
    return members;
  }

  /** `<T, U>` of the class that declares a constructor, for `new C<T>(...): C<T>`. */
  private ownerTypeArguments(element: TS.Node): string {
    const parent = element.parent;
    if (this.ts.isClassDeclaration(parent) && parent.typeParameters && parent.typeParameters.length > 0) {
      return `<${parent.typeParameters.map((p) => p.name.text).join(', ')}>`;
    }
    return '';
  }

  private enumMember(member: TS.EnumMember): ApiMember | null {
    const doc = this.docOf(member);
    if (this.isHidden(doc.tags)) return null;
    const value = this.checker.getConstantValue(member);
    return {
      name: member.name.getText(),
      kind: 'enum-member',
      static: false,
      readonly: true,
      optional: false,
      protected: false,
      abstract: false,
      type: value === undefined ? (member.initializer?.getText() ?? null) : JSON.stringify(value),
      summary: doc.summary,
      tags: doc.tags,
      signatures: [],
      source: this.sourceOf(member),
    };
  }
}

export class TypeScriptDatasource implements Datasource {
  readonly type = 'typescript';
  private data: QueryResult | null = null;
  private readonly config: TypeScriptDatasourceConfig;

  constructor(config: DatasourceConfig) {
    const entryPoints = config['entry_points'];
    if (
      !Array.isArray(entryPoints) ||
      entryPoints.length === 0 ||
      !entryPoints.every((e) => typeof e === 'string')
    ) {
      throw new Error('TypeScript datasource requires "entry_points" (a list of file paths)');
    }
    const template = config['source_link_template'];
    if (template !== undefined && typeof template !== 'string') {
      throw new Error('TypeScript datasource "source_link_template" must be a string');
    }
    if (typeof template === 'string' && template.includes('{gitRevision}') && typeof config['git_revision'] !== 'string') {
      throw new Error(
        'TypeScript datasource "source_link_template" uses {gitRevision}; set "git_revision" (e.g. main)'
      );
    }
    const sort = config['sort'];
    if (sort !== undefined && sort !== 'source-order' && sort !== 'alphabetical') {
      throw new Error('TypeScript datasource "sort" must be "source-order" or "alphabetical"');
    }
    for (const key of ['exclude_internal', 'exclude_private', 'exclude_externals']) {
      if (config[key] !== undefined && typeof config[key] !== 'boolean') {
        throw new Error(`TypeScript datasource "${key}" must be true or false`);
      }
    }
    this.config = config as TypeScriptDatasourceConfig;
  }

  private async loadData(): Promise<QueryResult> {
    if (this.data !== null) {
      return this.data;
    }

    const ts = await loadTypeScript();
    const cwd = process.cwd();
    const entryFiles = this.config.entry_points.map((e) => resolve(cwd, e));

    const configPath = this.config.tsconfig
      ? resolve(cwd, this.config.tsconfig)
      : ts.findConfigFile(dirname(entryFiles[0]!), ts.sys.fileExists);
    let options: TS.CompilerOptions = {};
    if (configPath) {
      const read = ts.readConfigFile(configPath, ts.sys.readFile);
      if (read.error) {
        throw new Error(`Cannot read ${configPath}: ${ts.flattenDiagnosticMessageText(read.error.messageText, '\n')}`);
      }
      options = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(configPath)).options;
    }
    options = { ...options, noEmit: true };

    const program = ts.createProgram({ rootNames: entryFiles, options });
    const extractor = new ApiExtractor(ts, program, program.getTypeChecker(), {
      excludeInternal: this.config.exclude_internal ?? true,
      excludePrivate: this.config.exclude_private ?? true,
      excludeExternals: this.config.exclude_externals ?? true,
      sourceLinkTemplate: this.config.source_link_template ?? null,
      gitRevision: this.config.git_revision ?? null,
      sort: this.config.sort ?? 'source-order',
      baseDir: cwd,
      displayDir: commonDirectory(entryFiles),
    });

    this.data = extractor.extract(entryFiles);
    return this.data;
  }

  async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
    return filterRows(await this.loadData(), sql, params);
  }

  async getAll(): Promise<QueryResult> {
    return this.loadData();
  }

  async close(): Promise<void> {
    this.data = null;
  }
}

export function createTypeScriptDatasource(config: DatasourceConfig): TypeScriptDatasource {
  return new TypeScriptDatasource(config);
}
