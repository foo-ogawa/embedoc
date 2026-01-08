# Embed API Reference

embedoc Embed API

This module exports all types and functions needed for writing custom embeds.

## Example

```typescript
import { defineEmbed, type EmbedContext, type EmbedResult } from 'embedoc';

export default defineEmbed({
  dependsOn: ['my_datasource'],
  async render(ctx: EmbedContext): Promise<EmbedResult> {
    const data = await ctx.datasources.my_datasource.query('SELECT * FROM table');
    return { content: ctx.markdown.table(['Column'], data.map(r => [r.name])) };
  }
});
```

## Interfaces

### Datasource

Defined in: types/index.ts:184

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

| Property | Modifier | Type | Description | Defined in |
| ------ | ------ | ------ | ------ | ------ |
| <a id="type"></a> `type` | `readonly` | `string` | Datasource type identifier. One of: 'sqlite', 'csv', 'json', 'yaml', 'glob', 'inline' | types/index.ts:189 |

#### Methods

##### getAll()

```ts
getAll(): Promise<QueryResult>;
```

Defined in: types/index.ts:238

Get all data from the datasource.

Returns all records without filtering. Recommended for
CSV, JSON, YAML, and Glob datasources.

###### Returns

`Promise`\<[`QueryResult`](#queryresult)\>

Promise resolving to an array of all records

###### Example

```typescript
// CSV datasource
const endpoints = await ctx.datasources['api_endpoints'].getAll();

// JSON datasource
const config = await ctx.datasources['config'].getAll();
```

##### query()

```ts
query(sql: string, params?: unknown[]): Promise<QueryResult>;
```

Defined in: types/index.ts:219

Execute a parameterized query on the datasource.

**SQLite**: Execute SQL with parameters from marker attributes or frontmatter.
This allows dynamic filtering based on the document context.

**CSV/JSON/YAML/Glob**: Parameters are ignored; use `getAll()` instead.

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `sql` | `string` | SQL query string with `?` placeholders for parameters |
| `params?` | `unknown`[] | Values to bind to the placeholders (prevents SQL injection) |

###### Returns

`Promise`\<[`QueryResult`](#queryresult)\>

Promise resolving to an array of records

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

***

### EmbedContext

Defined in: types/index.ts:459

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
| <a id="datasources"></a> `datasources` | `Record`\<`string`, [`Datasource`](#datasource)\> | Map of configured datasources. Keys are datasource names from `embedoc.config.yaml`. Includes both external datasources and inline datasources defined in the document. **Example** `// Access SQLite datasource const db = ctx.datasources['metadata_db']; const rows = await db.query('SELECT * FROM users'); // Access inline datasource const config = ctx.datasources['project_config']; const data = await config.getAll();` | types/index.ts:513 |
| <a id="filepath"></a> `filePath` | `string` | Absolute path to the current file being processed. Useful for generating relative links or file references. **Example** `const dir = path.dirname(ctx.filePath); const relativePath = path.relative(dir, targetFile);` | types/index.ts:536 |
| <a id="frontmatter"></a> `frontmatter` | `Record`\<`string`, `unknown`\> | Frontmatter data from the document. Parsed from YAML frontmatter at the top of the document. **Example** `// Document frontmatter: // --- // doc_id: "users" // schema: "public" // --- const docId = ctx.frontmatter['doc_id'] as string;` | types/index.ts:493 |
| <a id="markdown"></a> `markdown` | [`MarkdownHelper`](#markdownhelper) | Markdown generation helper. Always available. Provides methods for creating tables, lists, code blocks, links, and other Markdown elements. **See** [MarkdownHelper](#markdownhelper) | types/index.ts:523 |
| <a id="params"></a> `params` | `Record`\<`string`, `string`\> | Parameters from the marker attributes. Parsed from the marker syntax: `<!--@embedoc:embed_name param1="value1" param2="value2"-->` Variable references (`${...}`) are resolved before passing to the embed. **Example** `// Marker: <!--@embedoc:table_columns id="users" schema="public"--> const { id, schema } = ctx.params; // id = "users", schema = "public"` | types/index.ts:475 |

***

### EmbedDefinition

Defined in: types/index.ts:590

Embed definition interface.

Use with [defineEmbed](#defineembed) to create custom embeds.
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
| <a id="dependson"></a> `dependsOn?` | `string`[] | List of datasource names this embed depends on. Used for dependency tracking in incremental builds. When a datasource changes, all documents using embeds that depend on it will be rebuilt. **Example** `dependsOn: ['metadata_db', 'api_endpoints']` | types/index.ts:603 |

#### Methods

##### render()

```ts
render(ctx: EmbedContext): Promise<EmbedResult>;
```

Defined in: types/index.ts:614

Render function that generates the embed content.

Called for each marker in the document that references this embed.
Receives the context object with parameters, datasources, and helpers.

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `ctx` | [`EmbedContext`](#embedcontext) | The embed context |

###### Returns

`Promise`\<[`EmbedResult`](#embedresult)\>

Promise resolving to the embed result with generated content

***

### EmbedResult

Defined in: types/index.ts:551

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
| <a id="content"></a> `content` | `string` | Generated content to insert between the markers. This string replaces the existing content between the start and end markers in the document. | types/index.ts:558 |

***

### MarkdownHelper

Defined in: types/index.ts:283

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

##### bold()

```ts
bold(text: string): string;
```

Defined in: types/index.ts:395

Wrap text in bold formatting.

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `text` | `string` | Text to make bold |

###### Returns

`string`

Bold formatted string

###### Example

```typescript
ctx.markdown.bold('Important');
// Output: **Important**
```

##### checkbox()

```ts
checkbox(checked: boolean): string;
```

Defined in: types/index.ts:423

Generate a checkbox character.

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `checked` | `boolean` | Whether the checkbox is checked |

###### Returns

`string`

Checkbox character ('✔' if checked, '' if not)

###### Example

```typescript
ctx.markdown.checkbox(true);   // Output: ✔
ctx.markdown.checkbox(false);  // Output: (empty string)
```

##### codeBlock()

```ts
codeBlock(code: string, language?: string): string;
```

Defined in: types/index.ts:351

Generate a fenced code block.

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `code` | `string` | The code content |
| `language?` | `string` | Optional language identifier for syntax highlighting |

###### Returns

`string`

Formatted Markdown code block string

###### Example

```typescript
ctx.markdown.codeBlock('const x = 1;', 'typescript');
// Output:
// ```typescript
// const x = 1;
// ```
```

##### heading()

```ts
heading(text: string, level?: number): string;
```

Defined in: types/index.ts:381

Generate a Markdown heading.

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `text` | `string` | Heading text |
| `level?` | `number` | Heading level (1-6), defaults to 1 |

###### Returns

`string`

Formatted Markdown heading string

###### Example

```typescript
ctx.markdown.heading('Section Title', 2);
// Output: ## Section Title
```

##### italic()

```ts
italic(text: string): string;
```

Defined in: types/index.ts:409

Wrap text in italic formatting.

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `text` | `string` | Text to make italic |

###### Returns

`string`

Italic formatted string

###### Example

```typescript
ctx.markdown.italic('Emphasis');
// Output: *Emphasis*
```

##### link()

```ts
link(text: string, url: string): string;
```

Defined in: types/index.ts:366

Generate a Markdown link.

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `text` | `string` | Link display text |
| `url` | `string` | Link URL |

###### Returns

`string`

Formatted Markdown link string

###### Example

```typescript
ctx.markdown.link('Visit Google', 'https://google.com');
// Output: [Visit Google](https://google.com)
```

##### list()

```ts
list(items: string[], ordered?: boolean): string;
```

Defined in: types/index.ts:333

Generate a Markdown list.

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `items` | `string`[] | Array of list item strings |
| `ordered?` | `boolean` | If true, creates numbered list; if false, creates bullet list |

###### Returns

`string`

Formatted Markdown list string

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

##### table()

```ts
table(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string;
```

Defined in: types/index.ts:307

Generate a Markdown table.

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `headers` | `string`[] | Array of column header strings |
| `rows` | (`string` \| `number` \| `boolean` \| `null` \| `undefined`)[][] | 2D array of cell values (each inner array is a row) |

###### Returns

`string`

Formatted Markdown table string

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

## Type Aliases

### QueryResult

```ts
type QueryResult = Record<string, unknown>[];
```

Defined in: types/index.ts:149

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

## Variables

### defineEmbed

```ts
const defineEmbed: DefineEmbedFn;
```

Defined in: index.ts:166

Define a custom embed for generating content in documents.

Embeds are TypeScript modules that generate content for markers
in your documents. Use this function to create type-safe embed definitions.

#### Param

The embed definition object

#### Returns

The same definition object (for type inference)

#### Examples

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

 - [EmbedDefinition](#embeddefinition) for the definition interface
 - [EmbedContext](#embedcontext) for the context object passed to render
 - [MarkdownHelper](#markdownhelper) for markdown generation utilities
