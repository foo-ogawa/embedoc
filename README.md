# embedoc

[![npm version](https://badge.fury.io/js/embedoc.svg)](https://www.npmjs.com/package/embedoc)　[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**In-Place Document Generator** - A tool that auto-updates marker blocks in documents and source code while preserving manually edited sections.


## Overview

embedoc provides "In-Place template update" functionality that auto-updates specific blocks (regions enclosed by markers) within documents or source code while preserving manually edited sections.

```markdown
# Manually written heading

This part can be manually edited.

<!--@embedoc:table_columns id="users"-->
(This content is auto-generated)
<!--@embedoc:end-->

This part can also be manually edited.
```

**Auto-generated and manually edited sections coexist in the same file** without separating source and built files.

## Features

- **In-Place Updates**: Auto-generated and manually edited sections coexist in the same file
- **Multiple Comment Formats**: Supports HTML, block, line, hash, SQL comment formats
- **Programmable Embeds**: Write marker embedding logic in TypeScript (no compilation required)
- **Multiple Datasources**: SQLite, CSV, JSON, YAML, and glob support
- **Inline Datasources**: Define data directly in documents with `@embedoc-data` markers
- **File Generation**: Generate new files in bulk using Handlebars templates
- **Watch Mode**: Monitor file changes and auto-rebuild with incremental builds
- **Dependency Tracking**: Automatic dependency graph analysis for efficient rebuilds

## Installation

```bash
npm install embedoc
# or
pnpm add embedoc
# or
yarn add embedoc
```

## Quick Start

### 1. Initialize Project

```bash
npx embedoc init
```

This creates:
- `embedoc.config.yaml` - configuration file
- `.embedoc/renderers/index.ts` - renderer registration
- `.embedoc/datasources/index.ts` - custom datasource registration
- `.embedoc/templates/` - Handlebars templates directory

If `package.json` exists, npm scripts are also added:
- `npm run embedoc:build` - build documents
- `npm run embedoc:watch` - watch mode
- `npm run embedoc:generate` - run generators

### 2. Configure

Edit `embedoc.config.yaml` to set your targets and datasources:

```yaml
# embedoc.config.yaml
version: "1.0"

targets:
  - pattern: "./docs/**/*.md"
    comment_style: html
    exclude:
      - "**/node_modules/**"

datasources:
  metadata_db:
    type: sqlite
    path: "./data/metadata.db"
```

### 3. Create a Renderer

```typescript
// .embedoc/renderers/table_columns.ts
import { defineEmbed } from 'embedoc';

export default defineEmbed({
  dependsOn: ['metadata_db'],

  async render(ctx) {
    const { id } = ctx.params;

    if (!id) {
      return { content: '❌ Error: id parameter is required' };
    }

    const columns = await ctx.datasources['metadata_db']!.query(
      `SELECT * FROM columns WHERE table_name = ? ORDER BY ordinal_position`,
      [id]
    );

    const markdown = ctx.markdown.table(
      ['Column', 'Type', 'NOT NULL', 'Default', 'Comment'],
      columns.map((col) => [
        col['column_name'],
        col['data_type'],
        col['not_null'] ? '✔' : '',
        col['default_value'] ?? 'NULL',
        col['column_comment'] ?? '',
      ])
    );

    return { content: markdown };
  },
});
```

Register your renderer in `.embedoc/renderers/index.ts`:

```typescript
// .embedoc/renderers/index.ts
import tableColumns from './table_columns.ts';

export const embeds = {
  table_columns: tableColumns,
};
```

> **Note**: embedoc can directly import TypeScript files, so **no compilation is required**.

### 4. Add Markers to Your Document

```markdown
# Users Table

<!--@embedoc:table_columns id="users"-->
<!--@embedoc:end-->
```

### 5. Run Build

```bash
npx embedoc build
# or, if scripts were added to package.json:
npm run embedoc:build
```

---

## CLI Commands

> **Full CLI reference:** [docs/cli-reference.md](./docs/cli-reference.md) | **Machine-readable contract:** [cli-contract.yaml](./cli-contract.yaml)

```bash
# Initialize project (creates config, .embedoc/ directory, updates package.json)
embedoc init
embedoc init --force   # overwrite existing files

# Build all files
embedoc build
embedoc build --config embedoc.config.yaml

# Build specific files only
embedoc build ./path/to/file.md

# Generate new files (specific datasource)
embedoc generate --datasource tables

# Generate with specific template
embedoc generate --datasource tables --generator table_doc.hbs

# Run all datasource generators
embedoc generate --all

# Watch mode (incremental build)
embedoc watch
embedoc watch --config embedoc.config.yaml

# Debug dependency graph
embedoc watch --debug-deps

# Dry run (no file writes)
embedoc build --dry-run

# Verbose output
embedoc build --verbose
```

All commands can be run directly with `npx embedoc <command>` or via package.json scripts after `embedoc init`.

---

## Configuration File

### Full Configuration Reference

```yaml
# embedoc.config.yaml
version: "1.0"

# Target files
targets:
  - pattern: "./docs/**/*.md"
    comment_style: html
    exclude:
      - "**/node_modules/**"
      - "**/.git/**"
  - pattern: "./src/**/*.ts"
    comment_style: block
  - pattern: "./scripts/**/*.py"
    comment_style: hash
  - pattern: "./db/**/*.sql"
    comment_style: sql

# Custom comment style definitions (optional)
comment_styles:
  html:
    start: "<!--"
    end: "-->"
  block:
    start: "/*"
    end: "*/"
  line:
    start: "//"
    end: ""
  hash:
    start: "#"
    end: ""
  sql:
    start: "--"
    end: ""
  # Custom formats
  lua:
    start: "--[["
    end: "]]"

# Datasource definitions
datasources:
  # Schema datasource with generators
  tables:
    type: sqlite
    path: "./data/metadata.db"
    query: "SELECT * FROM tables"
    generators:
      - output_path: "./docs/tables/{table_name}.md"
        template: table_doc.hbs
        overwrite: false
  
  # Connection datasource (for queries from embeds)
  metadata_db:
    type: sqlite
    path: "./data/metadata.db"
  
  # CSV datasource
  api_endpoints:
    type: csv
    path: "./data/endpoints.csv"
    encoding: utf-8
  
  # JSON datasource
  config:
    type: json
    path: "./data/config.json"
  
  # YAML datasource
  settings:
    type: yaml
    path: "./data/settings.yaml"
  
  # Glob datasource
  doc_files:
    type: glob
    pattern: "./docs/**/*.md"

# Renderer directory (TypeScript) - default: ".embedoc/renderers"
renderers_dir: ".embedoc/renderers"

# Custom datasource types directory - default: ".embedoc/datasources"
datasources_dir: ".embedoc/datasources"

# Template directory (Handlebars) - default: ".embedoc/templates"
templates_dir: ".embedoc/templates"

# Output settings
output:
  encoding: utf-8
  line_ending: lf  # or "crlf"

# Inline datasource configuration
inline_datasource:
  enabled: true
  maxBytes: 10240           # Max size per inline block (default: 10KB)
  allowedFormats:           # Allowed formats (default: all)
    - yaml
    - json
    - csv
    - table
    - text
  conflictPolicy: warn      # warn | error | prefer_external
  stripCodeFences: true     # Auto-strip ```yaml ... ``` fences
  stripPatterns:            # Custom patterns to strip (regex)
    - '^```\w*\s*\n?'
    - '\n?```\s*$'

# GitHub integration
# Used as base URL when generating repository links in embeds
# (e.g., ctx.markdown.link('file.ts', github.base_url + 'src/file.ts'))
github:
  base_url: "https://github.com/owner/repo/blob/main/"
```

---

## Marker Syntax

### Basic Syntax

```
{comment_start}@embedoc:{embed_name} {attr1}="{value1}" {attr2}="{value2}"{comment_end}
(auto-generated content)
{comment_start}@embedoc:end{comment_end}
```

### Supported Comment Formats

| Format | Start Marker | End Marker | Target Files |
|--------|-------------|------------|--------------|
| `html` | `<!--` | `-->` | `.md`, `.html`, `.xml` |
| `block` | `/*` | `*/` | `.js`, `.ts`, `.css`, `.java`, `.c` |
| `line` | `//` | (newline) | `.js`, `.ts`, `.java`, `.c`, `.go` |
| `hash` | `#` | (newline) | `.py`, `.rb`, `.sh`, `.yaml` |
| `sql` | `--` | (newline) | `.sql` |

### Examples by Format

**Markdown / HTML**
```markdown
<!--@embedoc:table_columns id="users"-->
| Column | Type | Comment |
| --- | --- | --- |
| id | integer | User ID |
<!--@embedoc:end-->
```

**TypeScript / JavaScript (block)**
```typescript
/*@embedoc:type_definition id="User"*/
export interface User {
  id: number;
  name: string;
}
/*@embedoc:end*/
```

**TypeScript / JavaScript (line)**
```typescript
//@embedoc:imports id="api-client"
import { ApiClient } from './api';
import { UserService } from './services/user';
//@embedoc:end
```

**Python**
```python
#@embedoc:constants id="config"
API_URL = "https://api.example.com"
TIMEOUT = 30
#@embedoc:end
```

**SQL**
```sql
--@embedoc:view_definition id="active_users"
CREATE VIEW active_users AS
SELECT * FROM users WHERE status = 'active';
--@embedoc:end
```

### Inline Mode

Use `inline="true"` to prevent newlines around the generated content. Useful for embedding values within table cells or inline text:

```markdown
| Name | Value |
|------|-------|
| User | <!--@embedoc:inline_value datasource="data" path="name" inline="true"-->John<!--@embedoc:end--> |
```

Without `inline="true"`, the output would include newlines and break the table formatting.

### Variable References in Attributes

Use `${...}` syntax in attribute values to reference Frontmatter properties or inline datasources.

```yaml
---
doc_id: "users"
schema: "public"
---
```

```markdown
<!--@embedoc:table_columns id="${doc_id}"-->
<!--@embedoc:end-->

<!--@embedoc:table_info id="${schema}.${doc_id}"-->
<!--@embedoc:end-->
```

---

## Embed API

### Basic Structure

```typescript
import { defineEmbed } from 'embedoc';

export default defineEmbed({
  // Datasources this embed depends on (for dependency tracking)
  dependsOn: ['metadata_db'],
  
  // Render function
  async render(ctx) {
    // ctx.params: Marker attribute values
    // ctx.frontmatter: Frontmatter YAML data
    // ctx.datasources: Access to datasources
    // ctx.markdown: Markdown helpers
    // ctx.filePath: Current file path being processed
    
    return { content: 'Generated content' };
  }
});
```

### Context Object

| Property | Type | Description |
|----------|------|-------------|
| `ctx.params` | `Record<string, string>` | Marker attribute values |
| `ctx.frontmatter` | `Record<string, unknown>` | Document frontmatter data |
| `ctx.datasources` | `Record<string, Datasource>` | Available datasources |
| `ctx.markdown` | `MarkdownHelper` | Markdown generation helpers |
| `ctx.filePath` | `string` | Current file path |
| `ctx.existingContent` | `string \| undefined` | Existing content between markers (for error recovery) |

### Error Recovery / Graceful Degradation

Return `null` or `undefined` from `render()` to keep existing content unchanged. This is useful when external data sources are unavailable.

```typescript
async render(ctx) {
  try {
    const data = await fetchFromDatabase(ctx.params['id']);
    return { content: formatData(data) };
  } catch (error) {
    // On error, keep existing content
    return { content: null };
  }
}
```

### Markdown Helpers

```typescript
// Table
ctx.markdown.table(
  ['Column', 'Type', 'Description'],
  [
    ['id', 'integer', 'Primary key'],
    ['name', 'varchar', 'User name'],
  ]
);

// List
ctx.markdown.list(['Item 1', 'Item 2', 'Item 3'], false);  // unordered
ctx.markdown.list(['First', 'Second', 'Third'], true);     // ordered

// Code block
ctx.markdown.codeBlock('const x = 1;', 'typescript');

// Link
ctx.markdown.link('Click here', 'https://example.com');

// Heading
ctx.markdown.heading('Section Title', 2);  // ## Section Title

// Inline formatting
ctx.markdown.bold('Important');    // **Important**
ctx.markdown.italic('Emphasis');   // *Emphasis*
ctx.markdown.checkbox(true);       // [x]
ctx.markdown.checkbox(false);      // [ ]
```

---

## Datasources

### SQLite

```yaml
datasources:
  metadata_db:
    type: sqlite
    path: "./data/metadata.db"
    # Optional: predefined query for generators
    query: "SELECT * FROM tables"
```

Usage in embed:
```typescript
const rows = await ctx.datasources['metadata_db'].query(
  'SELECT * FROM users WHERE id = ?',
  [userId]
);
```

### CSV

```yaml
datasources:
  endpoints:
    type: csv
    path: "./data/endpoints.csv"
    encoding: utf-8  # optional, default: utf-8
```

### JSON

```yaml
datasources:
  config:
    type: json
    path: "./data/config.json"
```

### YAML

```yaml
datasources:
  settings:
    type: yaml
    path: "./data/settings.yaml"
```

### Glob (File Listings)

```yaml
datasources:
  doc_files:
    type: glob
    pattern: "./docs/**/*.md"
```

Returns array of file info objects with `path`, `name`, `ext`, etc.

---

## Inline Datasources

Define data directly in documents using `@embedoc-data` markers.

### Basic Syntax

```markdown
<!--@embedoc-data:datasource_name format="yaml"-->
- name: Alice
  age: 25
- name: Bob
  age: 30
<!--@embedoc-data:end-->
```

### Supported Formats

| Format | Description |
|--------|-------------|
| `yaml` | YAML array or object (default) |
| `json` | JSON array or object |
| `csv` | CSV with header row |
| `table` | Markdown table |
| `text` | Plain text |

### Format Examples

**YAML (default)**
```markdown
<!--@embedoc-data:users format="yaml"-->
- id: 1
  name: Alice
  email: alice@example.com
- id: 2
  name: Bob
  email: bob@example.com
<!--@embedoc-data:end-->
```

**JSON**
```markdown
<!--@embedoc-data:config format="json"-->
{
  "api_url": "https://api.example.com",
  "timeout": 30
}
<!--@embedoc-data:end-->
```

**CSV**
```markdown
<!--@embedoc-data:endpoints format="csv"-->
method,path,description
GET,/users,List all users
POST,/users,Create user
<!--@embedoc-data:end-->
```

**Markdown Table**
```markdown
<!--@embedoc-data:features format="table"-->
| Feature | Status | Priority |
|---------|--------|----------|
| Auth    | Done   | High     |
| API     | WIP    | High     |
<!--@embedoc-data:end-->
```

### Code Fence Support

For better readability in editors, you can wrap data in code fences:

````markdown
<!--@embedoc-data:config format="yaml"-->
```yaml
api_url: https://api.example.com
timeout: 30
features:
  - auth
  - logging
```
<!--@embedoc-data:end-->
````

Code fences are automatically stripped during parsing.

### Dot-Path Access for Nested Data

Access nested properties using dot notation:

```markdown
<!--@embedoc-data:project format="yaml"-->
name: embedoc
version: 1.0.0
author:
  name: Jane Developer
  email: jane@example.com
repository:
  url: https://github.com/janedev/embedoc
<!--@embedoc-data:end-->

Project: ${project.name} v${project.version}
Author: ${project.author.name} (${project.author.email})
```

### Distributed Definition Style

Define data inline where it's contextually relevant:

```markdown
# Project Documentation

This project, <!--@embedoc-data:project.name-->embedoc<!--@embedoc-data:end-->, 
version <!--@embedoc-data:project.version-->1.0.0<!--@embedoc-data:end-->, 
provides in-place document generation.

## Author

Maintained by <!--@embedoc-data:project.author.name-->Jane Developer<!--@embedoc-data:end-->
(<!--@embedoc-data:project.author.email-->jane@example.com<!--@embedoc-data:end-->).

## Summary

| Property | Value |
|----------|-------|
| Name | ${project.name} |
| Version | ${project.version} |
| Author | ${project.author.name} |
```

Both YAML blocks and dot-path definitions produce the same structure and can be mixed.

> **Note**: If the same dot-path is defined multiple times within a document, the **last definition wins** (values are overwritten in document order).

### Using Inline Datasources in Embeds

```typescript
import { defineEmbed, InlineDatasource } from 'embedoc';

export default defineEmbed({
  async render(ctx) {
    const ds = ctx.datasources['my_data'] as InlineDatasource;
    
    // Get all data
    const data = await ds.getAll();
    
    // Get nested value (for object datasources)
    const authorName = await ds.get('author.name');
    
    // Get location metadata (for traceability)
    const meta = ds.getMeta('', ctx.filePath);  // '' = root definition
    if (meta) {
      // meta.relativePath: relative path from current document
      // meta.contentStartLine / contentEndLine: line numbers
      console.log(`Defined at ${meta.relativePath}:${meta.contentStartLine}`);
    }
    
    // Get location of specific property (for distributed definitions)
    const propMeta = ds.getMeta('author.name', ctx.filePath);
    
    return { content: ctx.markdown.table(/* ... */) };
  }
});
```

See [API Reference](./docs/api/README.md#inlinedatasource) for `InlineDatasource` details.

### Inline Datasource Configuration

```yaml
# embedoc.config.yaml
inline_datasource:
  enabled: true              # Enable/disable (default: true)
  maxBytes: 10240           # Max size per block (default: 10KB)
  allowedFormats:           # Restrict formats
    - yaml
    - json
  conflictPolicy: warn      # warn | error | prefer_external
  stripCodeFences: true     # Auto-strip code fences (default: true)
  stripPatterns:            # Custom strip patterns (regex)
    - '^```\w*\s*\n?'
    - '\n?```\s*$'
```

---

## Custom Datasources

Define custom datasource types in TypeScript to connect to any data source (APIs, databases, custom file formats, etc.).

### Defining a Custom Datasource Type

```typescript
// .embedoc/datasources/github.ts
import { defineDatasource } from 'embedoc';

export default defineDatasource({
  async create(config) {
    const owner = config['owner'] as string;
    const repo = config['repo'] as string;
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues`
    );
    const issues = await response.json();

    return {
      async query() { return issues; },
      async getAll() { return issues; },
      async close() {},
    };
  }
});
```

### Registering Custom Datasource Types

```typescript
// .embedoc/datasources/index.ts
import github from './github.ts';

export const datasourceTypes = {
  github,
};
```

### Using in Configuration

```yaml
# embedoc.config.yaml
datasources:
  my_issues:
    type: github         # matches key in datasourceTypes
    owner: "myorg"
    repo: "myrepo"
```

All config properties are passed to the `create()` method, so custom datasources can accept any configuration.

### Custom Inline Format Parsers

Register custom format parsers for `@embedoc-data` inline markers by exporting `inlineFormats` alongside `datasourceTypes`:

```typescript
// .embedoc/datasources/index.ts
import github from './github.ts';

export const datasourceTypes = {
  github,
};

export const inlineFormats = {
  toml: (content: string) => parseToml(content),
  ini: (content: string) => {
    const result: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const [key, ...rest] = line.split('=');
      if (key && rest.length > 0) {
        result[key.trim()] = rest.join('=').trim();
      }
    }
    return result;
  },
};
```

Custom formats can then be used in documents:

```markdown
<!--@embedoc-data:config format="ini"-->
host=localhost
port=5432
database=myapp
<!--@embedoc-data:end-->
```

---

## File Generation

Generate new files in bulk using Handlebars templates based on datasource records.

### Configuration

```yaml
datasources:
  tables:
    type: sqlite
    path: "./data/metadata.db"
    query: "SELECT * FROM tables"
    generators:
      - output_path: "./docs/tables/{table_name}.md"
        template: table_doc.hbs
        overwrite: false  # Don't overwrite existing files
```

### Template (Handlebars)

```handlebars
{{!-- .embedoc/templates/table_doc.hbs --}}
---
doc_id: "{{table_name}}"
embeds:
  - table_columns
  - table_relations
---
# Table: {{table_name}}

## Columns

<!--@embedoc:table_columns id="{{table_name}}"-->
<!--@embedoc:end-->

## Relations

<!--@embedoc:table_relations id="{{table_name}}"-->
<!--@embedoc:end-->

Created: {{today}}
```

### Built-in Handlebars Helpers

| Helper | Description | Example Output |
|--------|-------------|----------------|
| `{{today}}` | Today's date (YYYY-MM-DD) | `YYYY-MM-DD` |
| `{{datetime}}` | Current datetime (ISO 8601) | `YYYY-MM-DDTHH:mm:ss.sssZ` |
| `{{#if condition}}` | Conditional | `{{#if is_primary}}✔{{/if}}` |
| `{{#each items}}` | Loop | `{{#each columns}}{{name}}{{/each}}` |
| `{{#unless condition}}` | Negation | `{{#unless nullable}}NOT NULL{{/unless}}` |

### Run Generation

```bash
# Generate for specific datasource
embedoc generate --datasource tables

# Generate for all datasources with generators
embedoc generate --all
```

---

## Incremental Build & Dependency Tracking

### Dependency Chain

```
Document (.md) → Embed (.ts) → Datasource (.db, .csv, .json)
```

- **Document changed**: Rebuild that document only
- **Embed changed**: Rebuild all documents using that embed
- **Datasource changed**: Rebuild all documents using embeds that depend on that datasource

### Watch Mode

```bash
embedoc watch --config embedoc.config.yaml
```

### Debug Dependency Graph

```bash
embedoc watch --debug-deps
```

Example output:
```
=== Dependency Graph ===

[document] docs/tables/users.md
  depends on:
    - embed:table_columns
    - embed:table_relations

[embed] embed:table_columns
  depends on:
    - data/sample.db
  depended by:
    - docs/tables/users.md
    - docs/tables/orders.md

[datasource] data/sample.db
  depended by:
    - embed:table_columns
    - embed:table_relations
```

---

## Frontmatter

Documents can include YAML frontmatter for metadata and configuration:

```yaml
---
doc_id: "users"
doc_type: "table"
schema: "public"
embeds:
  - table_columns
  - table_relations
---
```

Frontmatter values can be referenced in marker attributes using `${...}` syntax.

---

## Directory Structure

### Recommended Project Structure

```
your-project/
├── embedoc.config.yaml        # Configuration file
├── .embedoc/                   # All embedoc custom code
│   ├── renderers/              # Renderer definitions (TypeScript)
│   │   ├── index.ts            # Export all renderers
│   │   ├── table_columns.ts
│   │   └── table_relations.ts
│   ├── datasources/            # Custom datasource types (TypeScript)
│   │   ├── index.ts            # Export datasourceTypes and inlineFormats
│   │   └── github.ts
│   ├── templates/              # File generation templates (Handlebars)
│   │   ├── table_doc.hbs
│   │   └── view_doc.hbs
│   └── package.json            # Optional: dependencies for custom code
├── data/                       # Datasource files
│   ├── metadata.db
│   └── endpoints.csv
└── docs/                       # Target documents
    └── tables/
        └── users.md
```

### Renderer Registration

```typescript
// .embedoc/renderers/index.ts
import tableColumns from './table_columns.ts';
import tableRelations from './table_relations.ts';
import customEmbed from './custom_embed.ts';

export const embeds = {
  table_columns: tableColumns,
  table_relations: tableRelations,
  custom_embed: customEmbed,
};
```

---

## Development

### Building from Source

```bash
# Clone repository
git clone https://github.com/user/embedoc.git
cd embedoc

# Install dependencies
npm install

# Build
npm run build

# Development mode (watch)
npm run dev

# Run tests
npm test
```

### Requirements

- Node.js 18+
- npm / pnpm / yarn

---

## API Reference

> 📖 **See [docs/api/README.md](./docs/api/README.md) for detailed Embed API documentation.**

### Exported Functions

```typescript
import {
  // Core
  defineEmbed,
  defineDatasource,
  build,
  processFile,
  
  // Parser
  parseMarkers,
  parseFrontmatter,
  parseInlineDataMarkers,
  
  // Datasource utilities
  InlineDatasource,
  buildInlineDatasources,
  parseDotPath,
  resolveDotPath,
  
  // Helpers
  createMarkdownHelper,
  
  // Constants
  DEFAULT_COMMENT_STYLES,
} from 'embedoc';
```

### Type Definitions

```typescript
interface EmbedDefinition {
  dependsOn?: string[];
  render: (ctx: EmbedContext) => Promise<EmbedResult>;
}

interface EmbedResult {
  /** Return string to replace, or null/undefined to keep existing content */
  content: string | null | undefined;
}

interface EmbedContext {
  params: Record<string, string>;
  frontmatter: Record<string, unknown>;
  datasources: Record<string, Datasource>;
  markdown: MarkdownHelper;
  filePath: string;
  /** Existing content between markers (for error recovery) */
  existingContent?: string;
}

interface Datasource {
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  getAll(): Promise<QueryResult>;
  close(): Promise<void>;
}

interface InlineDatasource extends Datasource {
  readonly type: 'inline';
  readonly format: string;
  readonly locations: InlineDefinitionLocation[];
  get(path: string): Promise<unknown>;
  getMeta(propertyPath?: string, targetDocPath?: string): InlineDefinitionLocation | null;
  getAllMeta(targetDocPath?: string): InlineDefinitionLocation[];
}

interface InlineDefinitionLocation {
  propertyPath: string;
  absolutePath: string;
  relativePath: string;
  startLine: number;
  endLine: number;
  contentStartLine: number;
  contentEndLine: number;
  format: string;
}

interface InlineDatasourceConfig {
  enabled?: boolean;
  maxBytes?: number;
  allowedFormats?: string[];
  conflictPolicy?: 'warn' | 'error' | 'prefer_external';
  stripCodeFences?: boolean;
  stripPatterns?: string[];
}

interface CustomDatasourceDefinition {
  create(config: DatasourceConfig): Promise<Datasource>;
}

type InlineFormatParser = (content: string) => unknown;
```

---

## License

MIT

