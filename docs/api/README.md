# Embed API Reference

Types and functions for writing embeds, custom datasources and API references with embedoc.
Everything below is generated from [`src/embed-api.ts`](../../src/embed-api.ts) by the
`typescript` datasource (`npm run docs`).

<!--@embedoc:api_reference datasource="embed_api"-->
## Classes

### InlineDatasource

Defined in: [core/inline-datasource.ts:333](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L333)

Datasource for document-local data defined with `@embedoc-data` markers.

Embeds receive it in `ctx.datasources` like any other [`Datasource`](#datasource),
and can read where each property was defined with [`InlineDatasource.getMeta`](#inlinedatasource).

#### Implements

- [`Datasource`](#datasource)

#### Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="type"></a> `type` (readonly) | `"inline"` |  | [core/inline-datasource.ts:334](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L334) |
| <a id="format"></a> `format` (readonly) | `string` |  | [core/inline-datasource.ts:335](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L335) |
| <a id="documentpath"></a> `documentPath` (readonly) | `string` |  | [core/inline-datasource.ts:336](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L336) |
| <a id="startline"></a> `startLine` (readonly) | `number` |  | [core/inline-datasource.ts:337](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L337) |
| <a id="endline"></a> `endLine` (readonly) | `number` |  | [core/inline-datasource.ts:338](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L338) |
| <a id="bytesize"></a> `byteSize` (readonly) | `number` |  | [core/inline-datasource.ts:339](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L339) |

#### Methods

##### query()

```ts
query(_sql: string, _params?: unknown[]): Promise<QueryResult>;
```

Defined in: [core/inline-datasource.ts:380](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L380)

Query is not fully supported for inline datasources
Returns all data or filters by simple conditions

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `_sql` | `string` |
| `_params?` | `unknown[]` |

###### Returns

`Promise<`[`QueryResult`](#queryresult)`>`

***

##### getAll()

```ts
getAll(): Promise<QueryResult>;
```

Defined in: [core/inline-datasource.ts:392](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L392)

Get all data - returns array for Datasource interface compatibility

###### Returns

`Promise<`[`QueryResult`](#queryresult)`>`

***

##### getRawData()

```ts
getRawData(): unknown;
```

Defined in: [core/inline-datasource.ts:403](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L403)

Get raw data (object or array)

###### Returns

`unknown`

***

##### get()

```ts
get(dotPath: string): Promise<unknown>;
```

Defined in: [core/inline-datasource.ts:410](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L410)

Get value at dot-path

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `dotPath` | `string` |

###### Returns

`Promise<unknown>`

***

##### isObjectType()

```ts
isObjectType(): boolean;
```

Defined in: [core/inline-datasource.ts:417](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L417)

Check if datasource is object type (vs array)

###### Returns

`boolean`

***

##### close()

```ts
close(): Promise<void>;
```

Defined in: [core/inline-datasource.ts:424](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L424)

Close (no-op for inline)

###### Returns

`Promise<void>`

***

##### getMeta()

```ts
getMeta(propertyPath?: string, targetDocPath?: string): InlineDefinitionLocation | null;
```

Defined in: [core/inline-datasource.ts:445](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L445)

Get location metadata for a specific property definition

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `propertyPath?` | `string` | Property path to look up (default: '' for root) **Default** `''` |
| `targetDocPath?` | `string` | Base path for relative path calculation |

###### Returns

[`InlineDefinitionLocation`](#inlinedefinitionlocation)`| null`

Location metadata or null if not found

***

##### getAllMeta()

```ts
getAllMeta(targetDocPath?: string): InlineDefinitionLocation[];
```

Defined in: [core/inline-datasource.ts:457](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L457)

Get all definition locations with relative paths calculated

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `targetDocPath?` | `string` | Base path for relative path calculation |

###### Returns

[`InlineDefinitionLocation`](#inlinedefinitionlocation)`[]`

Array of all definition locations (sorted by propertyPath)

## Interfaces

### InlineDefinitionLocation

Defined in: [core/inline-datasource.ts:31](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L31)

Location metadata for an inline definition

#### Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="propertypath"></a> `propertyPath` | `string` | Property path ('' for root definition) | [core/inline-datasource.ts:33](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L33) |
| <a id="absolutepath"></a> `absolutePath` | `string` | Absolute file path | [core/inline-datasource.ts:35](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L35) |
| <a id="relativepath"></a> `relativePath` | `string` | Relative path from target document (calculated on access) | [core/inline-datasource.ts:37](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L37) |
| <a id="startline"></a> `startLine` | `number` | Marker start line (1-indexed) | [core/inline-datasource.ts:39](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L39) |
| <a id="endline"></a> `endLine` | `number` | Marker end line | [core/inline-datasource.ts:41](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L41) |
| <a id="contentstartline"></a> `contentStartLine` | `number` | Content start line (excluding marker) | [core/inline-datasource.ts:43](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L43) |
| <a id="contentendline"></a> `contentEndLine` | `number` | Content end line (excluding marker) | [core/inline-datasource.ts:45](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L45) |
| <a id="format"></a> `format` | `string` | Data format | [core/inline-datasource.ts:47](https://github.com/foo-ogawa/embedoc/blob/main/src/core/inline-datasource.ts#L47) |

***

### ApiMarkdownOptions

Defined in: [helpers/api-markdown.ts:22](https://github.com/foo-ogawa/embedoc/blob/main/src/helpers/api-markdown.ts#L22)

Options for [`renderApiIndex`](#renderapiindex) and [`renderApiPage`](#renderapipage).

#### Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="categoryorder"></a> `categoryOrder?` | `string[]` | Order of category headings. `*` marks where the categories that are not listed go (alphabetically); without `*` they go last. Symbols without a `@category` tag are in the category `Other`. Category headings appear only in kind groups where at least one symbol has a category. | [helpers/api-markdown.ts:29](https://github.com/foo-ogawa/embedoc/blob/main/src/helpers/api-markdown.ts#L29) |
| <a id="indexfile"></a> `indexFile?` | `string` | File name of the index page, for links from symbol pages (default: `README.md`). | [helpers/api-markdown.ts:31](https://github.com/foo-ogawa/embedoc/blob/main/src/helpers/api-markdown.ts#L31) |
| <a id="headinglevel"></a> `headingLevel?` | `number` | Heading level of the kind groups on the index page (default: 2). | [helpers/api-markdown.ts:33](https://github.com/foo-ogawa/embedoc/blob/main/src/helpers/api-markdown.ts#L33) |

***

### DatasourceConfig

Defined in: [types/index.ts:60](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L60)

Datasource configuration.

The `type` field accepts built-in types ('sqlite', 'csv', 'json', 'yaml', 'glob', 'typescript')
or any custom type name registered via `datasources_dir`.
Custom types receive the entire config object (including arbitrary properties)
in their `create()` method.

#### Indexable

| Index | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="key-string"></a> `[key: string]` | `unknown` |  | [types/index.ts:67](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L67) |

#### Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="type"></a> `type` | `string` |  | [types/index.ts:61](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L61) |
| <a id="path"></a> `path?` | `string` |  | [types/index.ts:62](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L62) |
| <a id="pattern"></a> `pattern?` | `string` |  | [types/index.ts:63](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L63) |
| <a id="query"></a> `query?` | `string` |  | [types/index.ts:64](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L64) |
| <a id="encoding"></a> `encoding?` | `string` |  | [types/index.ts:65](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L65) |
| <a id="generators"></a> `generators?` | `GeneratorConfig[]` |  | [types/index.ts:66](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L66) |

***

### Datasource

Defined in: [types/index.ts:217](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L217)

Datasource interface for accessing external data.

Datasources are configured in `embedoc.config.yaml` and accessed
via `ctx.datasources` in embed render functions.

**Note**: The `query` option in config is for **generators** (file generation).
In embeds, use `query()` method to execute **dynamic queries with parameters**
from marker attributes or frontmatter.

Supported datasource types:
- `sqlite` - SQLite database (supports parameterized queries)
- `csv` - CSV files (use `getAll()`)
- `json` - JSON files (use `getAll()`)
- `yaml` - YAML files (use `getAll()`)
- `glob` - File listings (use `getAll()`)
- `typescript` - Public API of TypeScript entry points (use `getAll()`)

#### Example

```typescript
// In your embed's render function
const ds = ctx.datasources['metadata_db'];

// SQLite: dynamic query with marker parameters
const { id } = ctx.params;  // From: <!--@embedoc:my_embed id="users"-->
const rows = await ds.query(
  'SELECT * FROM columns WHERE table_name = ?',
  [id]
);

// CSV/JSON/YAML: get all data
const allData = await ds.getAll();
```

#### Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="type"></a> `type` (readonly) | `string` | Datasource type identifier. One of: 'sqlite', 'csv', 'json', 'yaml', 'glob', 'typescript', 'inline' | [types/index.ts:222](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L222) |

#### Methods

##### query()

```ts
query(sql: string, params?: unknown[]): Promise<QueryResult>;
```

Defined in: [types/index.ts:254](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L254)

Execute a parameterized query on the datasource.

**SQLite**: Execute SQL with parameters from marker attributes or frontmatter.
This allows dynamic filtering based on the document context.

**CSV/JSON/YAML/Glob/TypeScript**: Only `WHERE column = ?` is understood
(the value is `params[0]`, compared as a string); any other query returns
every record. Use `getAll()` for everything.

###### Example

```typescript
// Dynamic query using marker parameter
const { id } = ctx.params;  // From: <!--@embedoc:table_columns id="users"-->
const columns = await ds.query(
  'SELECT * FROM columns WHERE table_name = ? ORDER BY ordinal_position',
  [id]
);

// Multiple parameters
const filtered = await ds.query(
  'SELECT * FROM users WHERE status = ? AND role = ?',
  [ctx.params['status'], ctx.params['role']]
);
```

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `sql` | `string` | SQL query string with `?` placeholders for parameters |
| `params?` | `unknown[]` | Values to bind to the placeholders (prevents SQL injection) |

###### Returns

`Promise<`[`QueryResult`](#queryresult)`>`

Promise resolving to an array of records

***

##### getAll()

```ts
getAll(): Promise<QueryResult>;
```

Defined in: [types/index.ts:273](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L273)

Get all data from the datasource.

Returns all records without filtering. Recommended for
CSV, JSON, YAML, and Glob datasources.

###### Example

```typescript
// CSV datasource
const endpoints = await ctx.datasources['api_endpoints'].getAll();

// JSON datasource
const config = await ctx.datasources['config'].getAll();
```

###### Returns

`Promise<`[`QueryResult`](#queryresult)`>`

Promise resolving to an array of all records

***

### CustomDatasourceDefinition

Defined in: [types/index.ts:299](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L299)

Definition for a custom datasource type.

Register custom datasource types by exporting a `datasourceTypes` object
from `.embedoc/datasources/index.ts`. Each value should be created with
[`defineDatasource`](#definedatasource).

The `create()` method receives the full datasource config from
`embedoc.config.yaml` (including any arbitrary properties) and must
return a [`Datasource`](#datasource) instance.

#### Methods

##### create()

```ts
create(config: DatasourceConfig): Promise<Datasource>;
```

Defined in: [types/index.ts:300](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L300)

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `config` | [`DatasourceConfig`](#datasourceconfig) |

###### Returns

`Promise<`[`Datasource`](#datasource)`>`

***

### TypeScriptDatasourceConfig

Defined in: [types/index.ts:329](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L329)

Configuration of the built-in `typescript` datasource.

The datasource reads the public API of TypeScript entry points with the
TypeScript compiler API and returns one [`ApiSymbol`](#apisymbol) record per exported
symbol. It needs the `typescript` package (>=5.0.0 <7.0.0) installed in the
project; it is an optional peer dependency of embedoc.

Paths are resolved against the current working directory, like the other
datasources.

#### Extends

- [`DatasourceConfig`](#datasourceconfig)

#### Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="type"></a> `type` | `'typescript'` |  | [types/index.ts:330](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L330) |
| <a id="entry_points"></a> `entry_points` | `string[]` | Entry point files whose exports form the public API. | [types/index.ts:332](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L332) |
| <a id="tsconfig"></a> `tsconfig?` | `string` | tsconfig.json to compile with (default: the nearest one above the first entry point). | [types/index.ts:334](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L334) |
| <a id="exclude_internal"></a> `exclude_internal?` | `boolean` | Leave out symbols and members tagged `@internal` (default: true). | [types/index.ts:336](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L336) |
| <a id="exclude_private"></a> `exclude_private?` | `boolean` | Leave out `private` and `#private` class members (default: true). | [types/index.ts:338](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L338) |
| <a id="exclude_externals"></a> `exclude_externals?` | `boolean` | Leave out symbols declared in external libraries such as node_modules (default: true). | [types/index.ts:340](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L340) |
| <a id="source_link_template"></a> `source_link_template?` | `string` | Source link URL with the placeholders `{path}` (relative to the working directory), `{line}` and `{gitRevision}`. No link is produced without it. | [types/index.ts:345](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L345) |
| <a id="git_revision"></a> `git_revision?` | `string` | Value of `{gitRevision}`. Required when the template uses `{gitRevision}`. | [types/index.ts:347](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L347) |
| <a id="sort"></a> `sort?` | `'source-order' \| 'alphabetical'` | Record order: `source-order` (file path, then position) or `alphabetical` (default: source-order). | [types/index.ts:349](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L349) |
| <a id="pages"></a> `pages?` | [`ApiSymbolKind`](#apisymbolkind)`[]` | Kinds whose symbols get a page of their own (`page` = `<kindDir>/<name>.md`, `hasPage` = true), e.g. `[class, interface, function]`. Default: none. The renderers and the generator read `page` / `hasPage`, so this list is the only place that decides which symbols have pages. | [types/index.ts:356](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L356) |

***

### MarkdownHelper

Defined in: [types/index.ts:540](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L540)

Helper interface for generating Markdown content.

Always available via `ctx.markdown` in embed render functions.
Provides methods for creating common Markdown elements:

#### Example

```typescript
export default defineEmbed({
  async render(ctx) {
    const { markdown } = ctx;

    // Create a table
    const table = markdown.table(
      ['Name', 'Age'],
      [['Alice', 25], ['Bob', 30]]
    );

    // Create a list
    const list = markdown.list(['Item 1', 'Item 2'], false);

    return { content: table + '\n\n' + list };
  }
});
```

#### Methods

##### table()

```ts
table(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string;
```

Defined in: [types/index.ts:564](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L564)

Generate a Markdown table.

###### Example

```typescript
ctx.markdown.table(
  ['Column', 'Type', 'Description'],
  [
    ['id', 'integer', 'Primary key'],
    ['name', 'varchar', 'User name'],
  ]
);
// Output:
// | Column | Type | Description |
// | --- | --- | --- |
// | id | integer | Primary key |
// | name | varchar | User name |
```

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `headers` | `string[]` | Array of column header strings |
| `rows` | `(string \| number \| boolean \| null \| undefined)[][]` | 2D array of cell values (each inner array is a row) |

###### Returns

`string`

Formatted Markdown table string

***

##### list()

```ts
list(items: string[], ordered?: boolean): string;
```

Defined in: [types/index.ts:590](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L590)

Generate a Markdown list.

###### Example

```typescript
// Unordered list
ctx.markdown.list(['Apple', 'Banana', 'Cherry'], false);
// Output:
// - Apple
// - Banana
// - Cherry

// Ordered list
ctx.markdown.list(['First', 'Second', 'Third'], true);
// Output:
// 1. First
// 2. Second
// 3. Third
```

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `items` | `string[]` | Array of list item strings |
| `ordered?` | `boolean` | If true, creates numbered list; if false, creates bullet list |

###### Returns

`string`

Formatted Markdown list string

***

##### codeBlock()

```ts
codeBlock(code: string, language?: string): string;
```

Defined in: [types/index.ts:608](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L608)

Generate a fenced code block.

###### Example

```typescript
ctx.markdown.codeBlock('const x = 1;', 'typescript');
// Output:
// ```typescript
// const x = 1;
// ```
```

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `code` | `string` | The code content |
| `language?` | `string` | Optional language identifier for syntax highlighting |

###### Returns

`string`

Formatted Markdown code block string

***

##### link()

```ts
link(text: string, url: string): string;
```

Defined in: [types/index.ts:623](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L623)

Generate a Markdown link.

###### Example

```typescript
ctx.markdown.link('Visit Google', 'https://google.com');
// Output: [Visit Google](https://google.com)
```

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `text` | `string` | Link display text |
| `url` | `string` | Link URL |

###### Returns

`string`

Formatted Markdown link string

***

##### heading()

```ts
heading(text: string, level?: number): string;
```

Defined in: [types/index.ts:638](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L638)

Generate a Markdown heading.

###### Example

```typescript
ctx.markdown.heading('Section Title', 2);
// Output: ## Section Title
```

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `text` | `string` | Heading text |
| `level?` | `number` | Heading level (1-6), defaults to 1 |

###### Returns

`string`

Formatted Markdown heading string

***

##### bold()

```ts
bold(text: string): string;
```

Defined in: [types/index.ts:652](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L652)

Wrap text in bold formatting.

###### Example

```typescript
ctx.markdown.bold('Important');
// Output: **Important**
```

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `text` | `string` | Text to make bold |

###### Returns

`string`

Bold formatted string

***

##### italic()

```ts
italic(text: string): string;
```

Defined in: [types/index.ts:666](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L666)

Wrap text in italic formatting.

###### Example

```typescript
ctx.markdown.italic('Emphasis');
// Output: *Emphasis*
```

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `text` | `string` | Text to make italic |

###### Returns

`string`

Italic formatted string

***

##### checkbox()

```ts
checkbox(checked: boolean): string;
```

Defined in: [types/index.ts:680](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L680)

Generate a checkbox character.

###### Example

```typescript
ctx.markdown.checkbox(true);   // Output: ✔
ctx.markdown.checkbox(false);  // Output: (empty string)
```

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `checked` | `boolean` | Whether the checkbox is checked |

###### Returns

`string`

Checkbox character ('✔' if checked, '' if not)

***

### EmbedContext

Defined in: [types/index.ts:716](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L716)

Context object passed to an embed's render function.

Provides access to:
- Marker parameters from the document
- Document frontmatter data
- Configured datasources
- Markdown generation helpers
- Current file path

#### Example

```typescript
export default defineEmbed({
  dependsOn: ['metadata_db'],
  async render(ctx) {
    // Access marker parameters
    const { id } = ctx.params;  // From: <!--@embedoc:my_embed id="users"-->

    // Access frontmatter
    const docType = ctx.frontmatter['doc_type'];

    // Query datasource
    const data = await ctx.datasources['metadata_db'].query(
      'SELECT * FROM tables WHERE name = ?',
      [id]
    );

    // Generate markdown
    return { content: ctx.markdown.table(['Name'], data.map(r => [r.name])) };
  }
});
```

#### Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="params"></a> `params` | `Record<string, string>` | Parameters from the marker attributes.<br><br>Parsed from the marker syntax: `<!--@embedoc:embed_name param1="value1" param2="value2"-->`<br><br>Variable references (`${...}`) are resolved before passing to the embed.<br><br>**Example** `// Marker: <!--@embedoc:table_columns id="users" schema="public"-->` `const { id, schema } = ctx.params;` `// id = "users", schema = "public"` | [types/index.ts:732](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L732) |
| <a id="frontmatter"></a> `frontmatter` | `Record<string, unknown>` | Frontmatter data from the document.<br><br>Parsed from YAML frontmatter at the top of the document.<br><br>**Example** `// Document frontmatter:` `// ---` `// doc_id: "users"` `// schema: "public"` `// ---` `const docId = ctx.frontmatter['doc_id'] as string;` | [types/index.ts:750](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L750) |
| <a id="datasources"></a> `datasources` | `Record<string,`[`Datasource`](#datasource)`>` | Map of configured datasources.<br><br>Keys are datasource names from `embedoc.config.yaml`. Includes both external datasources and inline datasources defined in the document.<br><br>**Example** `// Access SQLite datasource` `const db = ctx.datasources['metadata_db'];` `const rows = await db.query('SELECT * FROM users');` `// Access inline datasource` `const config = ctx.datasources['project_config'];` `const data = await config.getAll();` | [types/index.ts:770](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L770) |
| <a id="markdown"></a> `markdown` | [`MarkdownHelper`](#markdownhelper) | Markdown generation helper.<br><br>Always available. Provides methods for creating tables, lists, code blocks, links, and other Markdown elements.<br><br>**See** [`MarkdownHelper`](#markdownhelper) | [types/index.ts:780](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L780) |
| <a id="filepath"></a> `filePath` | `string` | Absolute path to the current file being processed.<br><br>Useful for generating relative links or file references.<br><br>**Example** `const dir = path.dirname(ctx.filePath);` `const relativePath = path.relative(dir, targetFile);` | [types/index.ts:793](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L793) |
| <a id="existingcontent"></a> `existingContent?` | `string` | Existing content between the markers (before replacement).<br><br>Useful for error recovery - return `existingContent` when data sources are unavailable to preserve the previous state.<br><br>**Example** `try {` `const data = await fetchFromDatabase();` `return { content: formatData(data) };` `} catch (error) {` `console.warn('Database unavailable, keeping existing content');` `return { content: ctx.existingContent ?? null };` `}` | [types/index.ts:812](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L812) |

***

### EmbedResult

Defined in: [types/index.ts:827](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L827)

Result object returned from an embed's render function.

#### Example

```typescript
export default defineEmbed({
  async render(ctx): Promise<EmbedResult> {
    return { content: '# Generated Content\n\nHello, World!' };
  }
});
```

#### Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="content"></a> `content` | `string \| null \| undefined` | Generated content to insert between the markers.<br><br>This string replaces the existing content between the start and end markers in the document.<br><br>Return `null` or `undefined` to keep the existing content (useful for error recovery when data sources are unavailable). | [types/index.ts:837](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L837) |

***

### EmbedDefinition

Defined in: [types/index.ts:869](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L869)

Embed definition interface.

Use with [`defineEmbed`](#defineembed) to create custom embeds.
Embeds are TypeScript modules that generate content
for markers in your documents.

#### Example

```typescript
import { defineEmbed } from 'embedoc';

export default defineEmbed({
  // Declare datasource dependencies for incremental builds
  dependsOn: ['metadata_db'],

  // Render function generates the content
  async render(ctx) {
    const { id } = ctx.params;
    const data = await ctx.datasources['metadata_db'].query(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    return {
      content: ctx.markdown.table(['Name', 'Email'], data.map(r => [r.name, r.email]))
    };
  }
});
```

#### Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="dependson"></a> `dependsOn?` | `string[]` | List of datasource names this embed depends on.<br><br>Used for dependency tracking in incremental builds. When a datasource changes, all documents using embeds that depend on it will be rebuilt.<br><br>**Example** `dependsOn: ['metadata_db', 'api_endpoints']` | [types/index.ts:882](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L882) |

#### Methods

##### render()

```ts
render(ctx: EmbedContext): Promise<EmbedResult>;
```

Defined in: [types/index.ts:893](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L893)

Render function that generates the embed content.

Called for each marker in the document that references this embed.
Receives the context object with parameters, datasources, and helpers.

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `ctx` | [`EmbedContext`](#embedcontext) | The embed context |

###### Returns

`Promise<`[`EmbedResult`](#embedresult)`>`

Promise resolving to the embed result with generated content

## Type Aliases

### QueryResult

```ts
type QueryResult = Record<string, unknown>[];
```

Defined in: [types/index.ts:181](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L181)

Query result returned from datasource operations.

An array of records, where each record is an object with string keys
and unknown values. Use type assertions when accessing specific fields.

#### Example

```typescript
const users = await ctx.datasources.db.query('SELECT * FROM users');
users.forEach(user => {
  console.log(user['name'] as string);
  console.log(user['age'] as number);
});
```

***

### InlineFormatParser

```ts
type InlineFormatParser = (content: string) => unknown;
```

Defined in: [types/index.ts:312](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L312)

Parser function for a custom inline datasource format.

Receives the raw text content from an `@embedoc-data` marker block
and returns the parsed data (object, array, or primitive).

Register custom formats by exporting an `inlineFormats` object
from `.embedoc/datasources/index.ts`.

***

### ApiSymbolKind

```ts
type ApiSymbolKind = | 'namespace'
  | 'enum'
  | 'class'
  | 'interface'
  | 'type'
  | 'variable'
  | 'function'
  | 'reference';
```

Defined in: [types/index.ts:360](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L360)

Kind of an exported API symbol. A `reference` is a second exported name of a symbol.

***

### ApiMemberKind

```ts
type ApiMemberKind = | 'constructor'
  | 'property'
  | 'accessor'
  | 'method'
  | 'call-signature'
  | 'index-signature'
  | 'enum-member';
```

Defined in: [types/index.ts:371](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L371)

Kind of a member of a class, interface, object type or enum.

***

### ApiSource

```ts
type ApiSource = {
  /** Path relative to the common directory of the entry points (for display). */
  file: string;
  /** Path relative to the working directory (the `{path}` of the link template). */
  path: string;
  /** 1-based line of the declaration name. */
  line: number;
  /** Link built from `source_link_template`, or null without a template. */
  url: string | null;
};
```

Defined in: [types/index.ts:381](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L381)

Where a declaration is in the source.

#### Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="file"></a> `file` | `string` | Path relative to the common directory of the entry points (for display). | [types/index.ts:383](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L383) |
| <a id="path"></a> `path` | `string` | Path relative to the working directory (the `{path}` of the link template). | [types/index.ts:385](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L385) |
| <a id="line"></a> `line` | `number` | 1-based line of the declaration name. | [types/index.ts:387](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L387) |
| <a id="url"></a> `url` | `string \| null` | Link built from `source_link_template`, or null without a template. | [types/index.ts:389](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L389) |

***

### ApiTag

```ts
type ApiTag = {
  /** Tag name without `@`. */
  tag: string;
  /** Tag text. `{@link ...}` inline tags are kept as written. */
  text: string;
};
```

Defined in: [types/index.ts:393](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L393)

A JSDoc block tag such as `@example`, `@deprecated` or `@see`.

#### Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="tag"></a> `tag` | `string` | Tag name without `@`. | [types/index.ts:395](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L395) |
| <a id="text"></a> `text` | `string` | Tag text. ``...`` inline tags are kept as written. | [types/index.ts:397](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L397) |

***

### ApiTypeParameter

```ts
type ApiTypeParameter = {
  name: string;
  constraint: string | null;
  default: string | null;
  description: string;
};
```

Defined in: [types/index.ts:401](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L401)

A type parameter of a declaration or signature.

#### Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="name"></a> `name` | `string` |  | [types/index.ts:402](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L402) |
| <a id="constraint"></a> `constraint` | `string \| null` |  | [types/index.ts:403](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L403) |
| <a id="default"></a> `default` | `string \| null` |  | [types/index.ts:404](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L404) |
| <a id="description"></a> `description` | `string` |  | [types/index.ts:405](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L405) |

***

### ApiParameter

```ts
type ApiParameter = {
  name: string;
  type: string;
  optional: boolean;
  rest: boolean;
  defaultValue: string | null;
  description: string;
};
```

Defined in: [types/index.ts:409](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L409)

A parameter of a signature.

#### Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="name"></a> `name` | `string` |  | [types/index.ts:410](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L410) |
| <a id="type"></a> `type` | `string` |  | [types/index.ts:411](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L411) |
| <a id="optional"></a> `optional` | `boolean` |  | [types/index.ts:412](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L412) |
| <a id="rest"></a> `rest` | `boolean` |  | [types/index.ts:413](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L413) |
| <a id="defaultvalue"></a> `defaultValue` | `string \| null` |  | [types/index.ts:414](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L414) |
| <a id="description"></a> `description` | `string` |  | [types/index.ts:415](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L415) |

***

### ApiSignature

```ts
type ApiSignature = {
  /** Declaration as code, e.g. `function f(a: string): void;`. */
  code: string;
  summary: string;
  tags: ApiTag[];
  typeParameters: ApiTypeParameter[];
  parameters: ApiParameter[];
  /** Return type and `@returns` text; null for constructors and setters. */
  returns: { type: string; description: string } | null;
  source: ApiSource;
};
```

Defined in: [types/index.ts:419](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L419)

A call, construct, method or accessor signature.

#### Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="code"></a> `code` | `string` | Declaration as code, e.g. `function f(a: string): void;`. | [types/index.ts:421](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L421) |
| <a id="summary"></a> `summary` | `string` |  | [types/index.ts:422](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L422) |
| <a id="tags"></a> `tags` | [`ApiTag`](#apitag)`[]` |  | [types/index.ts:423](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L423) |
| <a id="typeparameters"></a> `typeParameters` | [`ApiTypeParameter`](#apitypeparameter)`[]` |  | [types/index.ts:424](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L424) |
| <a id="parameters"></a> `parameters` | [`ApiParameter`](#apiparameter)`[]` |  | [types/index.ts:425](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L425) |
| <a id="returns"></a> `returns` | `{ type: string; description: string } \| null` | Return type and `@returns` text; null for constructors and setters. | [types/index.ts:427](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L427) |
| <a id="source"></a> `source` | [`ApiSource`](#apisource) |  | [types/index.ts:428](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L428) |

***

### ApiMember

```ts
type ApiMember = {
  name: string;
  kind: ApiMemberKind;
  static: boolean;
  readonly: boolean;
  optional: boolean;
  protected: boolean;
  abstract: boolean;
  /** Type of a property, index signature or enum member value; null otherwise. */
  type: string | null;
  summary: string;
  tags: ApiTag[];
  /** Signatures of constructors, methods, accessors (get then set) and call signatures. */
  signatures: ApiSignature[];
  source: ApiSource;
};
```

Defined in: [types/index.ts:432](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L432)

A member of a class, interface, object type alias or enum.

#### Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="name"></a> `name` | `string` |  | [types/index.ts:433](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L433) |
| <a id="kind"></a> `kind` | [`ApiMemberKind`](#apimemberkind) |  | [types/index.ts:434](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L434) |
| <a id="static"></a> `static` | `boolean` |  | [types/index.ts:435](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L435) |
| <a id="readonly"></a> `readonly` | `boolean` |  | [types/index.ts:436](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L436) |
| <a id="optional"></a> `optional` | `boolean` |  | [types/index.ts:437](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L437) |
| <a id="protected"></a> `protected` | `boolean` |  | [types/index.ts:438](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L438) |
| <a id="abstract"></a> `abstract` | `boolean` |  | [types/index.ts:439](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L439) |
| <a id="type"></a> `type` | `string \| null` | Type of a property, index signature or enum member value; null otherwise. | [types/index.ts:441](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L441) |
| <a id="summary"></a> `summary` | `string` |  | [types/index.ts:442](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L442) |
| <a id="tags"></a> `tags` | [`ApiTag`](#apitag)`[]` |  | [types/index.ts:443](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L443) |
| <a id="signatures"></a> `signatures` | [`ApiSignature`](#apisignature)`[]` | Signatures of constructors, methods, accessors (get then set) and call signatures. | [types/index.ts:445](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L445) |
| <a id="source"></a> `source` | [`ApiSource`](#apisource) |  | [types/index.ts:446](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L446) |

***

### ApiLinkTarget

```ts
type ApiLinkTarget = {
  /** Target as written in the comment, e.g. `DBModel.use`. */
  target: string;
  /** Exported symbol the target names. */
  name: string;
  kind: ApiSymbolKind;
  kindDir: string;
  /** Page of the target symbol (its `page`), or null when it is on the index. */
  page: string | null;
  /** Member part of the target (`use` in `DBModel.use`), or null. */
  member: string | null;
};
```

Defined in: [types/index.ts:453](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L453)

A ``...`` target in a symbol's documentation that resolves to an
exported symbol (or a member of one) of the same datasource.

#### Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="target"></a> `target` | `string` | Target as written in the comment, e.g. `DBModel.use`. | [types/index.ts:455](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L455) |
| <a id="name"></a> `name` | `string` | Exported symbol the target names. | [types/index.ts:457](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L457) |
| <a id="kind"></a> `kind` | [`ApiSymbolKind`](#apisymbolkind) |  | [types/index.ts:458](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L458) |
| <a id="kinddir"></a> `kindDir` | `string` |  | [types/index.ts:459](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L459) |
| <a id="page"></a> `page` | `string \| null` | Page of the target symbol (its `page`), or null when it is on the index. | [types/index.ts:461](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L461) |
| <a id="member"></a> `member` | `string \| null` | Member part of the target (`use` in `DBModel.use`), or null. | [types/index.ts:463](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L463) |

***

### ApiSymbol

```ts
type ApiSymbol = {
  /** Exported name. */
  name: string;
  kind: ApiSymbolKind;
  /** Display name of the kind, e.g. `Class`, `Type Alias`. */
  kindLabel: string;
  /** Directory name for the kind, e.g. `classes`, `type-aliases`. */
  kindDir: string;
  /** Text of the `@category` tag (also kept in `tags`), or null. */
  category: string | null;
  summary: string;
  tags: ApiTag[];
  /** Declaration as code for type aliases and variables; null otherwise. */
  code: string | null;
  typeParameters: ApiTypeParameter[];
  extends: string[];
  implements: string[];
  /** Overload signatures of a function. */
  signatures: ApiSignature[];
  /** Members of a class, interface, enum, or object type alias. */
  members: ApiMember[];
  source: ApiSource;
  /** True for an `abstract` class. */
  abstract: boolean;
  /** Whether the symbol has a page of its own (its kind is in the datasource's `pages`). */
  hasPage: boolean;
  /** Path of its page relative to the API root (`classes/Store.md`), or null. */
  page: string | null;
  /** For a `reference` (`export { A as B }`): the name `A` is documented under; null otherwise. */
  referenceOf: string | null;
  /**
   * Exported symbols this symbol refers to: `{@link ...}` targets, `referenceOf`,
   * and names used in its types (parameters, returns, properties, heritage).
   */
  links: ApiLinkTarget[];
};
```

Defined in: [types/index.ts:473](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L473)

One record of the `typescript` datasource: an exported symbol.

`name`, `kind`, `kindDir` and `category` are flat so they can be used in
`WHERE column = ?` queries and in generator `output_path` placeholders,
e.g. `./docs/api/{kindDir}/{name}.md`.

#### Properties

| Property | Type | Description | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="name"></a> `name` | `string` | Exported name. | [types/index.ts:475](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L475) |
| <a id="kind"></a> `kind` | [`ApiSymbolKind`](#apisymbolkind) |  | [types/index.ts:476](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L476) |
| <a id="kindlabel"></a> `kindLabel` | `string` | Display name of the kind, e.g. `Class`, `Type Alias`. | [types/index.ts:478](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L478) |
| <a id="kinddir"></a> `kindDir` | `string` | Directory name for the kind, e.g. `classes`, `type-aliases`. | [types/index.ts:480](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L480) |
| <a id="category"></a> `category` | `string \| null` | Text of the `@category` tag (also kept in `tags`), or null. | [types/index.ts:482](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L482) |
| <a id="summary"></a> `summary` | `string` |  | [types/index.ts:483](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L483) |
| <a id="tags"></a> `tags` | [`ApiTag`](#apitag)`[]` |  | [types/index.ts:484](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L484) |
| <a id="code"></a> `code` | `string \| null` | Declaration as code for type aliases and variables; null otherwise. | [types/index.ts:486](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L486) |
| <a id="typeparameters"></a> `typeParameters` | [`ApiTypeParameter`](#apitypeparameter)`[]` |  | [types/index.ts:487](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L487) |
| <a id="extends"></a> `extends` | `string[]` |  | [types/index.ts:488](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L488) |
| <a id="implements"></a> `implements` | `string[]` |  | [types/index.ts:489](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L489) |
| <a id="signatures"></a> `signatures` | [`ApiSignature`](#apisignature)`[]` | Overload signatures of a function. | [types/index.ts:491](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L491) |
| <a id="members"></a> `members` | [`ApiMember`](#apimember)`[]` | Members of a class, interface, enum, or object type alias. | [types/index.ts:493](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L493) |
| <a id="source"></a> `source` | [`ApiSource`](#apisource) |  | [types/index.ts:494](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L494) |
| <a id="abstract"></a> `abstract` | `boolean` | True for an `abstract` class. | [types/index.ts:496](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L496) |
| <a id="haspage"></a> `hasPage` | `boolean` | Whether the symbol has a page of its own (its kind is in the datasource's `pages`). | [types/index.ts:498](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L498) |
| <a id="page"></a> `page` | `string \| null` | Path of its page relative to the API root (`classes/Store.md`), or null. | [types/index.ts:500](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L500) |
| <a id="referenceof"></a> `referenceOf` | `string \| null` | For a `reference` (`export { A as B }`): the name `A` is documented under; null otherwise. | [types/index.ts:502](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L502) |
| <a id="links"></a> `links` | [`ApiLinkTarget`](#apilinktarget)`[]` | Exported symbols this symbol refers to: ``...`` targets, `referenceOf`, and names used in its types (parameters, returns, properties, heritage). | [types/index.ts:507](https://github.com/foo-ogawa/embedoc/blob/main/src/types/index.ts#L507) |

## Variables

### defineEmbed

```ts
const defineEmbed: DefineEmbedFn;
```

Defined in: [index.ts:188](https://github.com/foo-ogawa/embedoc/blob/main/src/index.ts#L188)

Define a custom embed for generating content in documents.

Embeds are TypeScript modules that generate content for markers
in your documents. Use this function to create type-safe embed definitions.

#### Examples

##### Basic embed

```typescript
import { defineEmbed } from 'embedoc';

export default defineEmbed({
  dependsOn: ['metadata_db'],
  async render(ctx) {
    const { id } = ctx.params;
    const data = await ctx.datasources['metadata_db'].query(
      'SELECT * FROM tables WHERE name = ?',
      [id]
    );
    return { content: ctx.markdown.table(['Name'], data.map(r => [r.name])) };
  }
});
```

##### Embed with multiple datasources

```typescript
import { defineEmbed } from 'embedoc';

export default defineEmbed({
  dependsOn: ['users_db', 'config'],
  async render(ctx) {
    const users = await ctx.datasources['users_db'].getAll();
    const config = await ctx.datasources['config'].getAll();

    return {
      content: ctx.markdown.table(
        ['Name', 'Role'],
        users.map(u => [u.name, u.role])
      )
    };
  }
});
```

##### Embed using frontmatter and parameters

```typescript
import { defineEmbed } from 'embedoc';

export default defineEmbed({
  async render(ctx) {
    // Access marker parameters: <!--@embedoc:my_embed title="Hello"-->
    const { title } = ctx.params;

    // Access document frontmatter
    const author = ctx.frontmatter['author'] as string;

    return {
      content: ctx.markdown.heading(title, 2) + '\n\nBy ' + author
    };
  }
});
```

#### See

- [`EmbedDefinition`](#embeddefinition) for the definition interface
- [`EmbedContext`](#embedcontext) for the context object passed to render
- [`MarkdownHelper`](#markdownhelper) for markdown generation utilities

## Functions

### renderApiIndex()

```ts
function renderApiIndex(records: QueryResult, options?: ApiMarkdownOptions): string;
```

Defined in: [helpers/api-markdown.ts:448](https://github.com/foo-ogawa/embedoc/blob/main/src/helpers/api-markdown.ts#L448)

Render the index page of an API: symbols grouped by kind (and by `@category`).

Symbols with a page (the datasource's `pages`) are listed as links to it;
the others are written in full. Records keep the order of the datasource.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `records` | [`QueryResult`](#queryresult) | Records of a `typescript` datasource |
| `options?` | [`ApiMarkdownOptions`](#apimarkdownoptions) | Rendering options **Default** `{}` |

#### Returns

`string`

Markdown

***

### renderApiPage()

```ts
function renderApiPage(record: Record<string, unknown>, options?: ApiMarkdownOptions): string;
```

Defined in: [helpers/api-markdown.ts:488](https://github.com/foo-ogawa/embedoc/blob/main/src/helpers/api-markdown.ts#L488)

Render the page of one symbol (its `page`, `<kindDir>/<name>.md`).

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `record` | `Record<string, unknown>` | One record of a `typescript` datasource |
| `options?` | [`ApiMarkdownOptions`](#apimarkdownoptions) | Rendering options; `indexFile` is used for links to symbols written on the index **Default** `{}` |

#### Returns

`string`

Markdown

***

### defineDatasource()

```ts
function defineDatasource(definition: CustomDatasourceDefinition): CustomDatasourceDefinition;
```

Defined in: [index.ts:226](https://github.com/foo-ogawa/embedoc/blob/main/src/index.ts#L226)

Define a custom datasource type for use in `embedoc.config.yaml`.

Custom datasource types are registered by exporting a `datasourceTypes`
object from `.embedoc/datasources/index.ts`. Each value should be
created with this function.

#### Example

```typescript
import { defineDatasource } from 'embedoc';

export default defineDatasource({
  async create(config) {
    const endpoint = config['endpoint'] as string;
    const data = await fetch(endpoint).then(r => r.json());
    return {
      async query() { return data; },
      async getAll() { return data; },
      async close() {},
    };
  }
});
```

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `definition` | [`CustomDatasourceDefinition`](#customdatasourcedefinition) | The custom datasource definition |

#### Returns

[`CustomDatasourceDefinition`](#customdatasourcedefinition)

The same definition (for type inference)

<!--@embedoc:end-->
