---
title: "Inline Datasource Demo"
embeds:
  - code_snippet
  - feature_table
---
# Inline Datasource Demo

This document demonstrates the inline datasource feature. Data is defined directly in the document and referenced throughout.

## Project Information

<!--@embedify-data:project format="yaml"-->
name: embedify
version: 1.0.0
description: In-Place Document Generator
author:
  name: Jane Developer
  email: jane@example.com
  github: janedev
repository:
  url: https://github.com/janedev/embedify
  branch: main
license: MIT
<!--@embedify-data:end-->

This project, **<!--@embedify:inline_value datasource="project" path="name" format="text"-->
embedify
<!--@embedify:end-->** (v<!--@embedify:inline_value datasource="project" path="version" format="text"-->
1.0.0
<!--@embedify:end-->), is a <!--@embedify:inline_value datasource="project" path="description" format="text"-->
In-Place Document Generator
<!--@embedify:end-->.

### Author

| Property | Value |
|----------|-------|
| Name | <!--@embedify:inline_value datasource="project" path="author.name" format="text"-->
Jane Developer
<!--@embedify:end--> |
| Email | <!--@embedify:inline_value datasource="project" path="author.email" format="text"-->
jane@example.com
<!--@embedify:end--> |
| GitHub | <!--@embedify:inline_value datasource="project" path="author.github" format="text"-->
janedev
<!--@embedify:end--> |

---

## Distributed Data Definition (Style 2)

You can also define data inline where it's contextually relevant:

### Current Version

The current stable version is <!--@embedify-data:meta.version-->2.0.0-beta<!--@embedify-data:end-->.

### Build Status

Build status: <!--@embedify-data:meta.build_status-->passing<!--@embedify-data:end-->

### Summary

| Property | Value |
|----------|-------|
| Version | <!--@embedify:inline_value datasource="meta" path="version" format="code"-->
`2.0.0-beta`
<!--@embedify:end--> |
| Build | <!--@embedify:inline_value datasource="meta" path="build_status" format="text"-->
passing
<!--@embedify:end--> |

---

## Code Reference Example

### Table Columns Embed

Here's a snippet from the `table_columns.ts` embed:

<!--@embedify:code_snippet file="./embeds/table_columns.ts" start="8" end="20" lang="typescript" title="table_columns.ts"-->
**table_columns.ts**

```typescript
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
```

📄 Source: `./embeds/table_columns.ts` (lines 8-20)
<!--@embedify:end-->

---

## Feature List

Features defined in inline datasource:

<!--@embedify-data:feature_list format="yaml"-->
- name: In-Place Updates
  description: Auto-generated and manually edited sections coexist
  status: stable
- name: Multiple Formats
  description: HTML, block, line, hash, SQL comment styles
  status: stable
- name: Inline Datasources
  description: Define data directly in documents
  status: beta
- name: Watch Mode
  description: Automatic rebuild on file changes
  status: stable
<!--@embedify-data:end-->

| Feature | Description | Status |
|---------|-------------|--------|
<!--@embedify:feature_table datasource="feature_list"-->
| In-Place Updates | Auto-generated and manually edited sections coexist | ✅ stable |
| Multiple Formats | HTML, block, line, hash, SQL comment styles | ✅ stable |
| Inline Datasources | Define data directly in documents | 🔶 beta |
| Watch Mode | Automatic rebuild on file changes | ✅ stable |
<!--@embedify:end-->

---

## Configuration Example (JSON format)

API configuration defined inline with JSON:

<!--@embedify-data:api_config format="json"-->
{
  "base_url": "https://api.example.com/v2",
  "timeout": 30,
  "retry": {
    "max_attempts": 3,
    "backoff": "exponential"
  }
}
<!--@embedify-data:end-->

| Setting | Value |
|---------|-------|
| Base URL | <!--@embedify:inline_value datasource="api_config" path="base_url" format="code"-->
`https://api.example.com/v2`
<!--@embedify:end--> |
| Timeout | <!--@embedify:inline_value datasource="api_config" path="timeout" format="text"-->
30
<!--@embedify:end--> seconds |
| Max Retries | <!--@embedify:inline_value datasource="api_config" path="retry.max_attempts" format="text"-->
3
<!--@embedify:end--> |

---

## Notes

This document demonstrates:

1. **Style 1 (YAML Block)**: Complex structured data in one block
2. **Style 2 (Dot-Path Names)**: Inline values distributed in context
3. **JSON Format**: Alternative data format support
4. **inline_value Embed**: Display values from inline datasources
5. **feature_table Embed**: Generate tables from inline data

All data is self-contained in this document, making it portable and self-documenting.
