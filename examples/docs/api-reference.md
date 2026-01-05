---
title: "API Reference"
embeds:
  - openapi_endpoints
  - api_endpoints
  - code_snippet
---
# API Reference

This document demonstrates embedify's capability to embed API documentation from various sources.

## OpenAPI Endpoints

The following endpoints are automatically extracted from our OpenAPI specification:

<!--@embedify:openapi_endpoints file="./data/openapi.yaml"-->
**Sample API** v1.0.0 (12 endpoints)

| Method | Endpoint | Description | Tags | Auth |
| --- | --- | --- | --- | --- |
| **POST** | `/auth/login` | User login | `Authentication` |  |
| **POST** | `/auth/logout` | User logout | `Authentication` | ✔ |
| **GET** | `/orders` | List all orders | `Orders` | ✔ |
| **POST** | `/orders` | Create a new order | `Orders` | ✔ |
| **GET** | `/products` | List all products | `Products` |  |
| **POST** | `/products` | Create a new product | `Products` | ✔ |
| **GET** | `/products/{id}` | Get product by ID | `Products` |  |
| **GET** | `/users` | List all users | `Users` | ✔ |
| **POST** | `/users` | Create a new user | `Users` | ✔ |
| **DELETE** | `/users/{id}` | Delete user | `Users` | ✔ |
| **GET** | `/users/{id}` | Get user by ID | `Users` | ✔ |
| **PUT** | `/users/{id}` | Update user | `Users` | ✔ |
<!--@embedify:end-->

## API Endpoints (from CSV)

These endpoints are loaded from a CSV datasource:

<!--@embedify:api_endpoints-->
| Endpoint | Method | Description | Auth Required |
| --- | --- | --- | --- |
| `/api/users` | **GET** | Get list of users | ✔ |
| `/api/users/{id}` | **GET** | Get specific user | ✔ |
| `/api/users` | **POST** | Create user | ✔ |
| `/api/users/{id}` | **PUT** | Update user | ✔ |
| `/api/users/{id}` | **DELETE** | Delete user | ✔ |
| `/api/auth/login` | **POST** | Login |  |
| `/api/auth/logout` | **POST** | Logout | ✔ |
<!--@embedify:end-->

## Code Examples

### Embed Definition Example

Here's how the `table_columns` embed is implemented:

<!--@embedify:code_snippet file="./embeds/table_columns.ts" start="8" end="25" title="table_columns.ts - Embed Definition"-->
**table_columns.ts - Embed Definition**

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
    const columns = await ctx.datasources['metadata_db']!.query(
      `SELECT * FROM columns WHERE table_name = ? ORDER BY ordinal_position`,
      [id]
    );

```

📄 Source: `./embeds/table_columns.ts` (lines 8-25)
<!--@embedify:end-->

### Configuration File Example

<!--@embedify:code_snippet file="./embedify.config.yaml" title="embedify.config.yaml"-->
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

  # CSV datasource
  api_endpoints:
    type: csv
    path: "./data/api_endpoints.csv"
    encoding: utf-8

# Embeds directory (TypeScript for marker embedding)
embeds_dir: "./embeds"

# Templates directory (Handlebars for file generation)
templates_dir: "./templates"

# Output settings
output:
  encoding: utf-8
  line_ending: lf

```

📄 Source: `./embedify.config.yaml` (lines full)
<!--@embedify:end-->

## Notes

- OpenAPI endpoints are automatically updated when the specification file changes
- CSV-based endpoints provide a simpler alternative for smaller projects
- Code snippets help keep documentation in sync with actual source code
