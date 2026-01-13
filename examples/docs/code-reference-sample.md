---
title: "Code Reference Sample with Inline Datasources"
---
# Code Reference Sample

This document demonstrates two approaches for code references:

1. **Traditional**: External file with line numbers (may break when code changes)
2. **Inline Datasource**: Define code inline with automatic location tracking (robust)

---

## Inline Datasource Approach (Recommended)

Define code snippets as inline datasources. Line numbers are automatically tracked, so references stay accurate even when surrounding content changes.

### Example: Helper Function

<!--@embedoc-data:helper_function format="text"-->
```typescript
export function calculateSum(a: number, b: number): number {
  return a + b;
}

export function calculateProduct(a: number, b: number): number {
  return a * b;
}
```
<!--@embedoc-data:end-->

**Rendered with automatic location tracking:**

<!--@embedoc:code_snippet datasource="helper_function" lang="typescript" title="Math Helper Functions"-->
**Math Helper Functions**

```typescript
export function calculateSum(a: number, b: number): number {
  return a + b;
}

export function calculateProduct(a: number, b: number): number {
  return a * b;
}
```

📄 Source: `./code-reference-sample.md` (lines 20-28)
<!--@embedoc:end-->

### Example: API Interface Definition

<!--@embedoc-data:api_interface format="text"-->
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
```
<!--@embedoc-data:end-->

<!--@embedoc:code_snippet datasource="api_interface" lang="typescript" title="API Response Interface"-->
**API Response Interface**

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
```

📄 Source: `./code-reference-sample.md` (lines 52-61)
<!--@embedoc:end-->

---

## External File Approach (Traditional)

Reference code from external files with explicit line numbers.

> ⚠️ **Note**: If the source file is edited, line numbers may become stale.

### Table Columns Embed

<!--@embedoc:code_snippet file="./embeds/table_columns.ts" start="1" end="20" lang="typescript" title="Table Columns Embed"-->
**Table Columns Embed**

```typescript
/**
 * table_columns Embed
 * Output table column information as a Markdown table
 */

import { defineEmbed } from 'embedoc';

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

📄 Source: `./embeds/table_columns.ts` (lines 1-20)
<!--@embedoc:end-->

---

## Distributed Definition Example

You can also define data properties inline throughout the document:

Project name: <!--@embedoc-data:project.name-->embedoc-examples<!--@embedoc-data:end-->

Version: <!--@embedoc-data:project.version-->1.0.0<!--@embedoc-data:end-->

Description: <!--@embedoc-data:project.description-->Example code snippets with inline datasources<!--@embedoc-data:end-->

**Generated summary:**

| Property | Value |
|----------|-------|
| Name | <!--@embedoc:inline_value datasource="project" path="name" format="text" inline="true"-->embedoc-examples<!--@embedoc:end--> |
| Version | <!--@embedoc:inline_value datasource="project" path="version" format="code" inline="true"-->`1.0.0`<!--@embedoc:end--> |
| Description | <!--@embedoc:inline_value datasource="project" path="description" format="text" inline="true"-->Example code snippets with inline datasources<!--@embedoc:end--> |

---

## Summary

| Approach | Pros | Cons |
|----------|------|------|
| **Inline Datasource** | Line numbers auto-update, self-contained | Code duplicated in document |
| **External File** | Single source of truth | Line numbers may become stale |

**Best Practice**: Use inline datasources for small, critical code snippets that must stay synchronized with documentation. Use external file references for larger code sections where line drift is acceptable.

