#!/usr/bin/env node

/**
 * embedify CLI
 */

import { Command } from 'commander';
import { readFile, access } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import pc from 'picocolors';
import chokidar from 'chokidar';
import { tsImport } from 'tsx/esm/api';
import type { EmbedifyConfig, EmbedDefinition } from './types/index.js';
import { initializeDatasources, closeDatasources } from './datasources/index.js';
import { build } from './core/processor.js';
import { generateAll } from './core/generator.js';
import { DependencyGraph } from './core/dependency.js';

const program = new Command();

program
  .name('embedify')
  .description('In-Place Document Generator')
  .version('0.1.0');

/**
 * Load configuration file
 */
async function loadConfig(configPath: string): Promise<EmbedifyConfig> {
  const absolutePath = resolve(configPath);
  const content = await readFile(absolutePath, { encoding: 'utf-8' });

  if (configPath.endsWith('.json')) {
    return JSON.parse(content) as EmbedifyConfig;
  }

  return yaml.load(content) as EmbedifyConfig;
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
 * Load embeds (supports both TypeScript and JavaScript)
 */
async function loadEmbeds(
  embedsDir: string
): Promise<Record<string, EmbedDefinition>> {
  const tsIndexPath = resolve(embedsDir, 'index.ts');
  const jsIndexPath = resolve(embedsDir, 'index.js');

  try {
    // First try TypeScript file
    if (await fileExists(tsIndexPath)) {
      // Use tsx to directly import TypeScript
      const module = await tsImport(tsIndexPath, import.meta.url) as { embeds?: Record<string, EmbedDefinition> };
      return module.embeds ?? {};
    }

    // Fall back to JavaScript
    if (await fileExists(jsIndexPath)) {
      const moduleUrl = pathToFileURL(jsIndexPath).href;
      const module = (await import(moduleUrl)) as { embeds?: Record<string, EmbedDefinition> };
      return module.embeds ?? {};
    }

    console.warn(
      pc.yellow(`Warning: No embeds found in ${embedsDir} (index.ts or index.js)`)
    );
    return {};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      pc.yellow(`Warning: Could not load embeds from ${embedsDir}: ${message}`)
    );
    return {};
  }
}

/**
 * build command
 */
program
  .command('build [files...]')
  .description('Build documents by replacing markers with embed results')
  .option('-c, --config <path>', 'Path to config file', 'embedify.config.yaml')
  .option('-d, --dry-run', 'Dry run without writing files')
  .option('-v, --verbose', 'Verbose output')
  .action(async (files: string[], options) => {
    const startTime = Date.now();

    try {
      console.log(pc.cyan('🔧 Loading configuration...'));
      const config = await loadConfig(options.config);

      console.log(pc.cyan('📦 Initializing datasources...'));
      const datasources = initializeDatasources(config);

      console.log(pc.cyan('📝 Loading embeds...'));
      const embedsDir = config.embeds_dir ?? './embeds';
      const embeds = await loadEmbeds(embedsDir);

      console.log(pc.cyan('🔄 Processing files...'));
      const result = await build(config, embeds, datasources, {
        dryRun: options.dryRun,
        verbose: options.verbose,
        specificFiles: files.length > 0 ? files : undefined,
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
  });

/**
 * generate command
 */
program
  .command('generate')
  .description('Generate new files from datasource records')
  .option('-c, --config <path>', 'Path to config file', 'embedify.config.yaml')
  .option('-s, --datasource <name>', 'Specific datasource to process')
  .option('-g, --generator <name>', 'Specific generator template to use')
  .option('-a, --all', 'Process all datasources')
  .option('-d, --dry-run', 'Dry run without writing files')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    const startTime = Date.now();

    try {
      if (!options.datasource && !options.all) {
        console.error(
          pc.red('Error: Either --datasource or --all must be specified')
        );
        process.exit(1);
      }

      console.log(pc.cyan('🔧 Loading configuration...'));
      const config = await loadConfig(options.config);

      console.log(pc.cyan('📦 Initializing datasources...'));
      const datasources = initializeDatasources(config);

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
  });

/**
 * watch command
 */
program
  .command('watch')
  .description('Watch files and rebuild on changes')
  .option('-c, --config <path>', 'Path to config file', 'embedify.config.yaml')
  .option('-v, --verbose', 'Verbose output')
  .option('--debug-deps', 'Show dependency graph for debugging')
  .action(async (options) => {
    try {
      console.log(pc.cyan('🔧 Loading configuration...'));
      const config = await loadConfig(options.config);

      console.log(pc.cyan('📦 Initializing datasources...'));
      let datasources = initializeDatasources(config);

      console.log(pc.cyan('📝 Loading embeds...'));
      const embedsDir = resolve(config.embeds_dir ?? './embeds');
      let embeds = await loadEmbeds(embedsDir);

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

        // Reload embeds if embed file changed
        let embedsReloaded = false;
        for (const [filePath] of changes) {
          if (filePath.startsWith(embedsDir) && filePath.endsWith('.ts')) {
            console.log(pc.yellow(`\n🔄 Embed changed: ${relative(process.cwd(), filePath)}`));
            console.log(pc.cyan('   Reloading embeds...'));
            try {
              // Import with new timestamp to clear tsx cache
              embeds = await loadEmbeds(embedsDir);
              embedsReloaded = true;
            } catch (error) {
              console.error(pc.red('   Failed to reload embeds:'), error);
              return;
            }
          }
        }

        // Rebuild dependency graph if embeds were reloaded
        if (embedsReloaded) {
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
          datasources = initializeDatasources(config);

          const result = await build(config, embeds, datasources, {
            verbose: options.verbose,
            specificFiles: Array.from(affectedDocs),
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
  });

program.parse();
