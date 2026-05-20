#!/usr/bin/env node

/**
 * embedoc CLI
 */

import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import yaml from 'js-yaml';
import pc from 'picocolors';
import chokidar from 'chokidar';
import { tsImport } from 'tsx/esm/api';
import { createProgram, type CommandHandlers } from './generated/program.js';
import type { EmbedocConfig, EmbedDefinition, CustomDatasourceDefinition, InlineFormatParser } from './types/index.js';
import { initializeDatasources, closeDatasources } from './datasources/index.js';
import { build } from './core/processor.js';
import { generateAll } from './core/generator.js';
import { DependencyGraph } from './core/dependency.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

/**
 * Load configuration file
 */
async function loadConfig(configPath: string): Promise<EmbedocConfig> {
  const absolutePath = resolve(configPath);
  const content = await readFile(absolutePath, { encoding: 'utf-8' });

  if (configPath.endsWith('.json')) {
    return JSON.parse(content) as EmbedocConfig;
  }

  return yaml.load(content) as EmbedocConfig;
}

/**
 * Check if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve renderers_dir from config, with embeds_dir as deprecated fallback
 */
function resolveRenderersDir(config: EmbedocConfig): string {
  if (config.renderers_dir) {
    return config.renderers_dir;
  }
  if (config.embeds_dir) {
    console.warn(
      pc.yellow('Warning: "embeds_dir" is deprecated. Use "renderers_dir" instead.')
    );
    return config.embeds_dir;
  }
  return '.embedoc/renderers';
}

/**
 * Load renderers (supports both TypeScript and JavaScript)
 */
async function loadRenderers(
  renderersDir: string
): Promise<Record<string, EmbedDefinition>> {
  const tsIndexPath = resolve(renderersDir, 'index.ts');
  const jsIndexPath = resolve(renderersDir, 'index.js');

  try {
    if (await fileExists(tsIndexPath)) {
      const module = await tsImport(tsIndexPath, import.meta.url) as { 
        embeds?: Record<string, EmbedDefinition>;
        default?: { embeds?: Record<string, EmbedDefinition> };
      };
      return module.embeds ?? module.default?.embeds ?? {};
    }

    if (await fileExists(jsIndexPath)) {
      const moduleUrl = pathToFileURL(jsIndexPath).href;
      const module = (await import(moduleUrl)) as { embeds?: Record<string, EmbedDefinition> };
      return module.embeds ?? {};
    }

    return {};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      pc.yellow(`Warning: Could not load renderers from ${renderersDir}: ${message}`)
    );
    return {};
  }
}

/**
 * Result of loading custom datasource modules
 */
interface CustomDatasourceModules {
  datasourceTypes: Record<string, CustomDatasourceDefinition>;
  inlineFormats: Record<string, InlineFormatParser>;
}

/**
 * Load custom datasource types and inline format parsers from datasources_dir
 */
async function loadCustomDatasources(
  datasourcesDir: string
): Promise<CustomDatasourceModules> {
  const tsIndexPath = resolve(datasourcesDir, 'index.ts');
  const jsIndexPath = resolve(datasourcesDir, 'index.js');

  const empty: CustomDatasourceModules = { datasourceTypes: {}, inlineFormats: {} };

  try {
    let module: {
      datasourceTypes?: Record<string, CustomDatasourceDefinition>;
      inlineFormats?: Record<string, InlineFormatParser>;
      default?: {
        datasourceTypes?: Record<string, CustomDatasourceDefinition>;
        inlineFormats?: Record<string, InlineFormatParser>;
      };
    } | undefined;

    if (await fileExists(tsIndexPath)) {
      module = await tsImport(tsIndexPath, import.meta.url) as typeof module;
    } else if (await fileExists(jsIndexPath)) {
      const moduleUrl = pathToFileURL(jsIndexPath).href;
      module = (await import(moduleUrl)) as typeof module;
    }

    if (!module) {
      return empty;
    }

    return {
      datasourceTypes: module.datasourceTypes ?? module.default?.datasourceTypes ?? {},
      inlineFormats: module.inlineFormats ?? module.default?.inlineFormats ?? {},
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      pc.yellow(`Warning: Could not load custom datasources from ${datasourcesDir}: ${message}`)
    );
    return empty;
  }
}

const handlers: CommandHandlers = {
  init: async (options) => {
    try {
      console.log(pc.cyan('📁 Initializing embedoc...\n'));

      const created: string[] = [];
      const skipped: string[] = [];

      const writeIfNotExists = async (filePath: string, content: string) => {
        const absPath = resolve(filePath);
        if (!options.force && await fileExists(absPath)) {
          skipped.push(filePath);
          return;
        }
        const dir = absPath.substring(0, absPath.lastIndexOf('/'));
        await mkdir(dir, { recursive: true });
        await writeFile(absPath, content, { encoding: 'utf-8' });
        created.push(filePath);
      };

      // embedoc.config.yaml
      const configContent = `version: "1.0"

targets:
  - pattern: "./docs/**/*.md"
    comment_style: html
    exclude:
      - "**/node_modules/**"
      - "**/.git/**"

datasources: {}
  # example_db:
  #   type: sqlite
  #   path: "./data/example.db"
  # example_csv:
  #   type: csv
  #   path: "./data/example.csv"
`;

      await writeIfNotExists('embedoc.config.yaml', configContent);

      // .embedoc/renderers/index.ts
      const renderersIndexContent = `/**
 * embedoc renderers
 *
 * Export your custom renderers here.
 * Each key becomes a marker name: <!--@embedoc:key_name ...-->
 */

// import myRenderer from './my_renderer.ts';

export const embeds = {
  // my_renderer: myRenderer,
};
`;

      await writeIfNotExists('.embedoc/renderers/index.ts', renderersIndexContent);

      // .embedoc/datasources/index.ts
      const datasourcesIndexContent = `/**
 * embedoc custom datasources and inline format parsers
 *
 * datasourceTypes: register custom datasource types usable in embedoc.config.yaml
 * inlineFormats: register custom parsers for @embedoc-data format="xxx" markers
 */

// import type { CustomDatasourceDefinition, InlineFormatParser } from 'embedoc';
// import myDatasource from './my_datasource.ts';

export const datasourceTypes = {
  // my_datasource: myDatasource,
};

export const inlineFormats = {
  // toml: (content: string) => parseToml(content),
};
`;

      await writeIfNotExists('.embedoc/datasources/index.ts', datasourcesIndexContent);

      // .embedoc/templates/ (create directory only via a .gitkeep)
      await writeIfNotExists('.embedoc/templates/.gitkeep', '');

      // Update package.json if it exists
      const pkgPath = resolve('package.json');
      if (await fileExists(pkgPath)) {
        const pkgRaw = await readFile(pkgPath, { encoding: 'utf-8' });
        const pkg = JSON.parse(pkgRaw) as Record<string, unknown>;
        const scripts = (pkg['scripts'] ?? {}) as Record<string, string>;
        let scriptsUpdated = false;

        const scriptEntries: [string, string][] = [
          ['embedoc:build', 'embedoc build'],
          ['embedoc:watch', 'embedoc watch'],
          ['embedoc:generate', 'embedoc generate --all'],
        ];

        for (const [key, value] of scriptEntries) {
          if (!(key in scripts)) {
            scripts[key] = value;
            scriptsUpdated = true;
          }
        }

        if (scriptsUpdated) {
          pkg['scripts'] = scripts;
          await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', { encoding: 'utf-8' });
          console.log(pc.green('   Updated package.json scripts:'));
          for (const [key, value] of scriptEntries) {
            if (!((pkgRaw.includes(`"${key}"`)))) {
              console.log(pc.gray(`     "${key}": "${value}"`));
            }
          }
          console.log('');
        }
      }

      // Summary
      if (created.length > 0) {
        console.log(pc.green('   Created:'));
        for (const f of created) {
          console.log(pc.gray(`     ${f}`));
        }
      }
      if (skipped.length > 0) {
        console.log(pc.yellow('   Skipped (already exists):'));
        for (const f of skipped) {
          console.log(pc.gray(`     ${f}`));
        }
      }

      console.log('');
      console.log(pc.green('✅ embedoc initialized!'));
      console.log('');
      console.log('   Next steps:');
      console.log(pc.cyan('   1. Edit embedoc.config.yaml to configure targets and datasources'));
      console.log(pc.cyan('   2. Add renderers in .embedoc/renderers/'));
      console.log(pc.cyan('   3. Run: npx embedoc build'));
    } catch (error) {
      console.error(pc.red('❌ Init failed:'));
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },

  build: async (files, options) => {
    const startTime = Date.now();

    try {
      console.log(pc.cyan('🔧 Loading configuration...'));
      const config = await loadConfig(options.config ?? 'embedoc.config.yaml');

      const datasourcesDir = config.datasources_dir ?? '.embedoc/datasources';
      const customModules = await loadCustomDatasources(datasourcesDir);

      console.log(pc.cyan('📦 Initializing datasources...'));
      const datasources = await initializeDatasources(config, customModules.datasourceTypes);

      console.log(pc.cyan('📝 Loading renderers...'));
      const renderersDir = resolveRenderersDir(config);
      const embeds = await loadRenderers(renderersDir);

      console.log(pc.cyan('🔄 Processing files...'));
      const result = await build(config, embeds, datasources, {
        dryRun: options.dryRun,
        verbose: options.verbose,
        specificFiles: files.length > 0 ? files : undefined,
        customInlineFormats: customModules.inlineFormats,
      });

      // Cleanup
      await closeDatasources(datasources);

      // Show results
      const duration = Date.now() - startTime;
      console.log('');
      console.log(pc.green('✅ Build completed!'));
      console.log(`   Files processed: ${result.totalFiles}`);
      console.log(`   Markers updated: ${result.totalMarkersUpdated}`);
      console.log(`   Success: ${result.successFiles}`);

      if (result.failedFiles > 0) {
        console.log(pc.red(`   Failed: ${result.failedFiles}`));
      }

      console.log(`   Duration: ${duration}ms`);

      if (options.dryRun) {
        console.log(pc.yellow('\n   (Dry run - no files were modified)'));
      }

      // Show error details for failures
      for (const r of result.results) {
        if (!r.success && r.error) {
          console.error(pc.red(`\n   Error in ${r.filePath}:`));
          console.error(`   ${r.error.message}`);
        }
      }

      process.exit(result.failedFiles > 0 ? 1 : 0);
    } catch (error) {
      console.error(pc.red('❌ Build failed:'));
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },

  generate: async (options) => {
    const startTime = Date.now();

    try {
      if (!options.datasource && !options.all) {
        console.error(
          pc.red('Error: Either --datasource or --all must be specified')
        );
        process.exit(1);
      }

      console.log(pc.cyan('🔧 Loading configuration...'));
      const config = await loadConfig(options.config ?? 'embedoc.config.yaml');

      const datasourcesDir = config.datasources_dir ?? '.embedoc/datasources';
      const customModules = await loadCustomDatasources(datasourcesDir);

      console.log(pc.cyan('📦 Initializing datasources...'));
      const datasources = await initializeDatasources(config, customModules.datasourceTypes);

      console.log(pc.cyan('📄 Generating files...'));
      const results = await generateAll(config, datasources, {
        dryRun: options.dryRun,
        verbose: options.verbose,
        datasourceName: options.datasource,
        generatorName: options.generator,
      });

      // Cleanup
      await closeDatasources(datasources);

      // Show results
      const duration = Date.now() - startTime;
      const generated = results.filter((r) => r.success && !r.skipped).length;
      const skipped = results.filter((r) => r.skipped).length;
      const failed = results.filter((r) => !r.success).length;

      console.log('');
      console.log(pc.green('✅ Generation completed!'));
      console.log(`   Generated: ${generated}`);
      console.log(`   Skipped (existing): ${skipped}`);

      if (failed > 0) {
        console.log(pc.red(`   Failed: ${failed}`));
      }

      console.log(`   Duration: ${duration}ms`);

      if (options.dryRun) {
        console.log(pc.yellow('\n   (Dry run - no files were created)'));
      }

      // Show failure details
      for (const r of results) {
        if (!r.success && r.error) {
          console.error(pc.red(`\n   Error for ${r.filePath}:`));
          console.error(`   ${r.error.message}`);
        }
      }

      process.exit(failed > 0 ? 1 : 0);
    } catch (error) {
      console.error(pc.red('❌ Generation failed:'));
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },

  watch: async (options) => {
    try {
      console.log(pc.cyan('🔧 Loading configuration...'));
      const config = await loadConfig(options.config ?? 'embedoc.config.yaml');

      const datasourcesDir = config.datasources_dir ?? '.embedoc/datasources';
      const customModules = await loadCustomDatasources(datasourcesDir);

      console.log(pc.cyan('📦 Initializing datasources...'));
      let datasources = await initializeDatasources(config, customModules.datasourceTypes);

      console.log(pc.cyan('📝 Loading renderers...'));
      const renderersDir = resolve(resolveRenderersDir(config));
      let embeds = await loadRenderers(renderersDir);

      // Build dependency graph
      console.log(pc.cyan('🔗 Building dependency graph...'));
      let depGraph = new DependencyGraph(config, embeds);
      await depGraph.build();

      if (options.debugDeps) {
        depGraph.dump();
      }

      // Collect watch targets
      const patterns = config.targets.map((t) => t.pattern);
      const additionalWatchPaths = depGraph.getWatchPaths();

      console.log(pc.cyan('👀 Watching for changes...'));
      console.log(`   Document patterns: ${patterns.join(', ')}`);
      if (additionalWatchPaths.length > 0) {
        console.log(`   Additional paths: ${additionalWatchPaths.map(p => relative(process.cwd(), p)).join(', ')}`);
      }

      const watcher = chokidar.watch([...patterns, ...additionalWatchPaths], {
        ignored: ['**/node_modules/**', '**/.git/**'],
        persistent: true,
        ignoreInitial: true,
      });

      // Debounce timer
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      const pendingChanges = new Map<string, 'change' | 'add'>();

      const processChanges = async () => {
        const changes = new Map(pendingChanges);
        pendingChanges.clear();

        let renderersReloaded = false;
        for (const [filePath] of changes) {
          if (filePath.startsWith(renderersDir) && filePath.endsWith('.ts')) {
            console.log(pc.yellow(`\n🔄 Renderer changed: ${relative(process.cwd(), filePath)}`));
            console.log(pc.cyan('   Reloading renderers...'));
            try {
              embeds = await loadRenderers(renderersDir);
              renderersReloaded = true;
            } catch (error) {
              console.error(pc.red('   Failed to reload renderers:'), error);
              return;
            }
          }
        }

        // Rebuild dependency graph if embeds were reloaded
        if (renderersReloaded) {
          console.log(pc.cyan('   Rebuilding dependency graph...'));
          depGraph = new DependencyGraph(config, embeds);
          await depGraph.build();
        }

        // Identify affected documents
        const affectedDocs = new Set<string>();

        for (const [filePath] of changes) {
          const affected = depGraph.getAffectedDocuments(filePath);
          for (const doc of affected) {
            affectedDocs.add(doc);
          }
        }

        if (affectedDocs.size === 0) {
          // Changed file might be a document itself
          for (const [filePath] of changes) {
            const absolutePath = resolve(filePath);
            // Check if matches target patterns
            for (const target of config.targets) {
              const { glob } = await import('glob');
              const matches = await glob(target.pattern, { absolute: true });
              if (matches.includes(absolutePath)) {
                affectedDocs.add(absolutePath);
                break;
              }
            }
          }
        }

        if (affectedDocs.size === 0) {
          console.log(pc.gray('\n   No affected documents found'));
          return;
        }

        console.log(pc.yellow(`\n📝 Rebuilding ${affectedDocs.size} document(s)...`));

        for (const docPath of affectedDocs) {
          console.log(pc.gray(`   - ${relative(process.cwd(), docPath)}`));
        }

        try {
          // Re-initialize datasources (especially for SQLite)
          await closeDatasources(datasources);
          datasources = await initializeDatasources(config, customModules.datasourceTypes);

          const result = await build(config, embeds, datasources, {
            verbose: options.verbose,
            specificFiles: Array.from(affectedDocs),
            customInlineFormats: customModules.inlineFormats,
          });

          if (result.totalMarkersUpdated > 0) {
            console.log(pc.green(`   ✅ Updated ${result.totalMarkersUpdated} marker(s)`));
          } else {
            console.log(pc.gray('   No markers updated'));
          }

          // Update dependency graph
          depGraph = new DependencyGraph(config, embeds);
          await depGraph.build();
        } catch (error) {
          console.error(pc.red('   ❌ Error:'), error);
        }
      };

      // Handle file changes with debounce
      const handleChange = (type: 'change' | 'add') => (filePath: string) => {
        pendingChanges.set(resolve(filePath), type);

        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(processChanges, 200);
      };

      watcher.on('change', handleChange('change'));
      watcher.on('add', handleChange('add'));

      // Exit on Ctrl+C
      process.on('SIGINT', async () => {
        console.log(pc.cyan('\n\n👋 Stopping watch...'));
        await watcher.close();
        await closeDatasources(datasources);
        process.exit(0);
      });
    } catch (error) {
      console.error(pc.red('❌ Watch failed:'));
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
};

createProgram(handlers, pkg.version).parse();
