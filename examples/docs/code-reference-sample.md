---
title: "Code Reference Sample with Inline Datasources"
---
# Code Reference Sample

This document demonstrates using inline datasources to manage code references. Define source file locations as data, then reference them in code snippets.

## Source Files Definition

<!--@embedify-data:sources format="yaml"-->
```
embeds:
  table_columns:
    file: ./embeds/table_columns.ts
    description: Table columns embed implementation
  code_snippet:
    file: ./embeds/code_snippet.ts
    description: Code snippet embed implementation
  openapi_endpoints:
    file: ./embeds/openapi_endpoints.ts
    description: OpenAPI endpoints embed
config:
  main:
    file: ./embedify.config.yaml
    description: Main configuration file
```
<!--@embedify-data:end-->

---

## Code Snippets

### 1. Table Columns Embed

**File**: <!--@embedify:inline_value datasource="sources" path="embeds.table_columns.file" format="code"-->
`./embeds/table_columns.ts`
<!--@embedify:end-->

**Description**: <!--@embedify:inline_value datasource="sources" path="embeds.table_columns.description" format="text"-->
Table columns embed implementation
<!--@embedify:end-->

<!--@embedify:code_snippet file="./embeds/table_columns.ts" start="1" end="25" lang="typescript"-->
```typescript
/**
 * table_columns Embed
 * Output table column information as a Markdown table
 */

import { defineEmbed } from '../../dist/index.js';

export default defineEmbed({
  // Datasources this embed depends on
  dependsOn: ['metadata_db'],

  async render(ctx) {
    // Get table name from parameters
    const { id } = ctx.params;

    if (!id) {
      return { content: '❌ Error: id parameter is required' };
    }

    // Get column information from datasource
    const columns = await ctx.datasources['metadata_db']!.query(
      `SELECT * FROM columns WHERE table_name = ? ORDER BY ordinal_position`,
      [id]
    );

```

📄 Source: `./embeds/table_columns.ts` (lines 1-25)
<!--@embedify:end-->

---

### 2. Code Snippet Embed

**File**: <!--@embedify:inline_value datasource="sources" path="embeds.code_snippet.file" format="code"-->
`./embeds/code_snippet.ts`
<!--@embedify:end-->

**Description**: <!--@embedify:inline_value datasource="sources" path="embeds.code_snippet.description" format="text"-->
Code snippet embed implementation
<!--@embedify:end-->

<!--@embedify:code_snippet file="./embeds/code_snippet.ts" start="14" end="45" lang="typescript" title="File reading and line extraction"-->
**File reading and line extraction**

```typescript

import { defineEmbed } from '../../dist/index.js';
import fs from 'node:fs';
import path from 'node:path';

export default defineEmbed({
  async render(ctx) {
    const filePath = ctx.params['file'];
    const startLine = parseInt(ctx.params['start'] || '1', 10);
    const endLine = ctx.params['end'] ? parseInt(ctx.params['end'], 10) : undefined;
    const lang = ctx.params['lang'] || detectLanguage(filePath);
    const title = ctx.params['title'];

    if (!filePath) {
      return { content: '⚠️ `file` parameter is required' };
    }

    // Resolve file path relative to project root (where embedify.config.yaml is)
    const resolvedPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      return { content: `⚠️ File not found: ${filePath}` };
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const lines = content.split('\n');

    // Extract specified line range
    const start = Math.max(1, startLine) - 1; // Convert to 0-based index
    const end = endLine ? Math.min(endLine, lines.length) : lines.length;
    const snippet = lines.slice(start, end).join('\n');

```

📄 Source: `./embeds/code_snippet.ts` (lines 14-45)
<!--@embedify:end-->

---

### 3. OpenAPI Endpoints Embed

**File**: <!--@embedify:inline_value datasource="sources" path="embeds.openapi_endpoints.file" format="code"-->
`./embeds/openapi_endpoints.ts`
<!--@embedify:end-->

**Description**: <!--@embedify:inline_value datasource="sources" path="embeds.openapi_endpoints.description" format="text"-->
OpenAPI endpoints embed
<!--@embedify:end-->

<!--@embedify:code_snippet file="./embeds/openapi_endpoints.ts" start="30" end="55" lang="typescript" title="OpenAPI parsing logic"-->
**OpenAPI parsing logic**

```typescript
        tags?: string[];
        operationId?: string;
        security?: Array<Record<string, string[]>>;
      }
    >
  >;
}

export default defineEmbed({
  async render(ctx) {
    const filePath = ctx.params['file'];
    const tagFilter = ctx.params['tag'];

    if (!filePath) {
      return { content: '⚠️ `file` parameter is required' };
    }

    // Resolve file path relative to project root
    const resolvedPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      return { content: `⚠️ File not found: ${filePath}` };
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    let spec: OpenAPISpec;
```

📄 Source: `./embeds/openapi_endpoints.ts` (lines 30-55)
<!--@embedify:end-->

---

## Configuration Reference

**File**: <!--@embedify:inline_value datasource="sources" path="config.main.file" format="code"-->
`./embedify.config.yaml`
<!--@embedify:end-->

**Description**: <!--@embedify:inline_value datasource="sources" path="config.main.description" format="text"-->
Main configuration file
<!--@embedify:end-->

<!--@embedify:code_snippet file="./embedify.config.yaml" start="1" end="30" lang="yaml" title="embedify.config.yaml"-->
**embedify.config.yaml**

```yaml
# embedify configuration file example
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

# Datasource definitions
datasources:
  # Datasource with schema (for generators)
  tables:
    type: sqlite
    path: "./data/sample.db"
    query: "SELECT * FROM tables"
    generators:
      - output_path: "./docs/tables/{table_name}.md"
        template: table_doc.hbs
        overwrite: false

  # Connection datasource (for templates)
  metadata_db:
    type: sqlite
    path: "./data/sample.db"

```

📄 Source: `./embedify.config.yaml` (lines 1-30)
<!--@embedify:end-->

---

## Summary

This document demonstrates:

1. **Centralized Source Definitions**: Define all source file paths in one inline datasource
2. **Metadata Display**: Show file paths and descriptions using `inline_value` embed
3. **Code Snippets**: Display actual code from referenced files
4. **Maintainability**: When file paths change, update only the datasource definition

The inline datasource acts as a **Single Source of Truth** for file references, making documentation easier to maintain.

