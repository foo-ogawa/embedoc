# embedoc CLI

In-place document generator that auto-updates marker blocks in documents and source code while preserving manually edited sections. Supports multiple datasources (SQLite, CSV, JSON, YAML, glob), programmable TypeScript renderers, Handlebars file generation, and incremental builds with dependency tracking.

**Version:** 0.12.0

## Table of Contents

- [embedoc](#embedoc)
  - [init](#embedoc-init)
  - [build](#embedoc-build)
  - [generate](#embedoc-generate)
  - [watch](#embedoc-watch)

---

## embedoc

In-place document generator with marker-based embedding.

### Global Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--version` | -V | No |  | Print version and exit. |
| `--help` | -h | No |  | Show help and exit. |

### init

Initialize embedoc in the current project.

Creates starter configuration and directory structure: embedoc.config.yaml, .embedoc/renderers/index.ts, .embedoc/datasources/index.ts, and .embedoc/templates/. If package.json exists, adds embedoc:build, embedoc:watch, and embedoc:generate npm scripts.

**Usage:**

```
embedoc init
```
```
embedoc init --force
```

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--force` | -f | No | `false` | Overwrite existing files. |

#### Exit Codes

**Exit 0:** Initialization succeeded.

- **stdout:** format=`text`

- **Generated files:**
  - `embedoc.config.yaml` (application/yaml) *(optional)*
  - `.embedoc/renderers/index.ts` (text/x-typescript) *(optional)*
  - `.embedoc/datasources/index.ts` (text/x-typescript) *(optional)*
  - `.embedoc/templates/.gitkeep` *(optional)*

**Exit 1:** Initialization failed (write error).

- **stderr:** format=`text`

#### Extensions

```yaml
x-agent: 
  risk_level: low
  requires_confirmation: false
  idempotent: true
  side_effects: 
    - file_write
    - directory_create
```

---

### build

Build documents by replacing markers with rendered content.

Loads configuration, initializes datasources, loads TypeScript renderers, and processes all target files (or specific files if provided). Each @embedoc marker block is re-rendered and the content between start/end markers is replaced in-place.

**Usage:**

```
embedoc build
```
```
embedoc build --config embedoc.config.yaml
```
```
embedoc build ./docs/tables/users.md
```
```
embedoc build --dry-run --verbose
```

#### Arguments

| Name | Required | Description |
|---|---|---|
| `files` *(variadic)* | No | Specific file paths to process. If omitted, processes all targets from config. |

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--config` | -c | No | `"embedoc.config.yaml"` | Path to config file (YAML or JSON). |
| `--dry-run` | -d | No | `false` | Preview changes without writing files. |
| `--verbose` | -v | No | `false` | Enable verbose output. |

#### Exit Codes

**Exit 0:** Build succeeded. All markers were processed without errors.

- **stdout:** format=`text`

**Exit 1:** Build failed (config not found, datasource error, or marker processing error).

- **stderr:** format=`text`

#### Extensions

```yaml
x-agent: 
  risk_level: medium
  requires_confirmation: false
  idempotent: true
  side_effects: 
    - file_write
  safe_dry_run_option: --dry-run
  recommended_before_use: 
    - Ensure embedoc.config.yaml exists (run init if needed).
    - Verify datasource files are accessible.
```

---

### generate

Generate new files from datasource records using Handlebars templates.

Reads datasource records and generates new files using Handlebars templates defined in the generators config. Requires either --datasource to process a specific datasource or --all to process all datasources that have generators configured. Optionally filter by generator template name with --generator.

**Usage:**

```
embedoc generate --datasource tables
```
```
embedoc generate --all
```
```
embedoc generate --datasource tables --generator table_doc.hbs
```
```
embedoc generate --all --dry-run --verbose
```

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--config` | -c | No | `"embedoc.config.yaml"` | Path to config file (YAML or JSON). |
| `--datasource` | -s | No |  | Specific datasource to process. |
| `--generator` | -g | No |  | Specific generator template to use. |
| `--all` | -a | No | `false` | Process all datasources that have generators configured. |
| `--dry-run` | -d | No | `false` | Preview generation without writing files. |
| `--verbose` | -v | No | `false` | Enable verbose output. |

#### Exit Codes

**Exit 0:** Generation succeeded.

- **stdout:** format=`text`

**Exit 1:** Generation failed (missing --datasource/--all, config not found, datasource error, or template error).

- **stderr:** format=`text`

#### Extensions

```yaml
x-agent: 
  risk_level: medium
  requires_confirmation: false
  idempotent: true
  side_effects: 
    - file_write
  safe_dry_run_option: --dry-run
  recommended_before_use: 
    - Ensure embedoc.config.yaml exists with generators configured.
    - Verify datasource files are accessible.
    - Ensure Handlebars templates exist in templates_dir.
```

---

### watch

Watch files and rebuild on changes with dependency tracking.

Monitors target files, renderers, and datasource files for changes. When a change is detected, rebuilds only affected documents using the dependency graph. Renderer changes trigger a full renderer reload and dependency graph rebuild. Runs until interrupted with SIGINT (Ctrl+C).

**Usage:**

```
embedoc watch
```
```
embedoc watch --config embedoc.config.yaml
```
```
embedoc watch --verbose
```
```
embedoc watch --debug-deps
```

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--config` | -c | No | `"embedoc.config.yaml"` | Path to config file (YAML or JSON). |
| `--verbose` | -v | No | `false` | Enable verbose rebuild output. |
| `--debug-deps` |  | No | `false` | Print dependency graph at startup for debugging. |

#### Signals

| Signal | Description |
|---|---|
| `SIGINT` | Gracefully stops the watcher, closes datasources, and exits. |

#### Exit Codes

**Exit 0:** Watcher stopped gracefully (via SIGINT).

- **stdout:** format=`text`

**Exit 1:** Watch failed (config not found or initialization error).

- **stderr:** format=`text`

#### Extensions

```yaml
x-agent: 
  risk_level: medium
  requires_confirmation: false
  idempotent: true
  side_effects: 
    - file_write
  recommended_before_use: 
    - Ensure embedoc.config.yaml exists (run init if needed).
    - Verify datasource files are accessible.
```

---
