/**
 * File Generator
 * Generate new files from datasource records using Handlebars templates
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import Handlebars from 'handlebars';
import type {
  EmbedifyConfig,
  DatasourceConfig,
  GeneratorConfig,
  GenerateResult,
  Datasource,
} from '../types/index.js';

/**
 * Register built-in Handlebars helpers
 */
function registerHelpers(): void {
  // today: Current date (YYYY-MM-DD)
  Handlebars.registerHelper('today', () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });

  // datetime: Current datetime
  Handlebars.registerHelper('datetime', () => {
    return new Date().toISOString();
  });

  // eq: Equal comparison
  Handlebars.registerHelper('eq', (a, b) => a === b);

  // ne: Not equal comparison
  Handlebars.registerHelper('ne', (a, b) => a !== b);

  // gt: Greater than
  Handlebars.registerHelper('gt', (a, b) => a > b);

  // lt: Less than
  Handlebars.registerHelper('lt', (a, b) => a < b);

  // and: Logical AND
  Handlebars.registerHelper('and', (...args) => {
    args.pop(); // Remove options
    return args.every(Boolean);
  });

  // or: Logical OR
  Handlebars.registerHelper('or', (...args) => {
    args.pop(); // Remove options
    return args.some(Boolean);
  });

  // json: JSON stringify
  Handlebars.registerHelper('json', (obj) => {
    return JSON.stringify(obj, null, 2);
  });

  // uppercase: Convert to uppercase
  Handlebars.registerHelper('uppercase', (str) => {
    return String(str ?? '').toUpperCase();
  });

  // lowercase: Convert to lowercase
  Handlebars.registerHelper('lowercase', (str) => {
    return String(str ?? '').toLowerCase();
  });

  // capitalize: Capitalize first letter
  Handlebars.registerHelper('capitalize', (str) => {
    const s = String(str ?? '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  });

  // replace: String replacement
  Handlebars.registerHelper('replace', (str, search, replacement) => {
    return String(str ?? '').replace(new RegExp(search, 'g'), replacement);
  });
}

// Register helpers
registerHelpers();

/**
 * Compile and render template
 */
async function renderTemplate(
  templatePath: string,
  data: Record<string, unknown>
): Promise<string> {
  const templateContent = await readFile(templatePath, { encoding: 'utf-8' });
  const template = Handlebars.compile(templateContent);
  return template(data);
}

/**
 * Replace output path placeholders
 * {column_name} -> record.column_name
 * Also supports column names with special characters (#, -, ., etc.)
 */
function resolveOutputPath(
  pathTemplate: string,
  record: Record<string, unknown>
): string {
  return pathTemplate.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = record[key];
    return value !== null && value !== undefined ? String(value) : '';
  });
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
 * Generate file from a single record
 */
async function generateFile(
  record: Record<string, unknown>,
  generatorConfig: GeneratorConfig,
  templatesDir: string,
  config: EmbedifyConfig,
  dryRun = false
): Promise<GenerateResult> {
  // Resolve output path
  const outputPath = resolveOutputPath(generatorConfig.output_path, record);

  const result: GenerateResult = {
    filePath: outputPath,
    success: true,
    skipped: false,
  };

  try {
    // Check existing file
    const exists = await fileExists(outputPath);

    if (exists && !generatorConfig.overwrite) {
      result.skipped = true;
      return result;
    }

    // Resolve template path
    const templatePath = join(templatesDir, generatorConfig.template);

    // Render template
    const content = await renderTemplate(templatePath, record);

    if (!dryRun) {
      // Create directory
      await mkdir(dirname(outputPath), { recursive: true });

      // Write file
      const lineEnding = config.output?.line_ending ?? 'lf';
      const outputContent =
        lineEnding === 'crlf' ? content.replace(/\n/g, '\r\n') : content;

      await writeFile(outputPath, outputContent, {
        encoding: config.output?.encoding ?? 'utf-8',
      });
    }
  } catch (error) {
    result.success = false;
    result.error = error instanceof Error ? error : new Error(String(error));
  }

  return result;
}

/**
 * Generate files from datasource
 */
export async function generateFromDatasource(
  datasourceName: string,
  datasourceConfig: DatasourceConfig,
  datasource: Datasource,
  config: EmbedifyConfig,
  options: {
    dryRun?: boolean;
    verbose?: boolean;
    generatorName?: string;
  } = {}
): Promise<GenerateResult[]> {
  const results: GenerateResult[] = [];

  if (!datasourceConfig.generators || datasourceConfig.generators.length === 0) {
    if (options.verbose) {
      console.log(`No generators defined for datasource: ${datasourceName}`);
    }
    return results;
  }

  // Templates directory
  const templatesDir = config.templates_dir ?? './templates';

  // Get data
  const records = await datasource.getAll();

  if (options.verbose) {
    console.log(`Found ${records.length} records in datasource: ${datasourceName}`);
  }

  // Process each generator
  for (const generatorConfig of datasourceConfig.generators) {
    // Filter by specific generator if provided
    if (options.generatorName && generatorConfig.template !== options.generatorName) {
      continue;
    }

    if (options.verbose) {
      console.log(`  Generator: ${generatorConfig.template}`);
    }

    // Generate file for each record
    for (const record of records) {
      const result = await generateFile(
        record,
        generatorConfig,
        templatesDir,
        config,
        options.dryRun
      );

      results.push(result);

      if (options.verbose) {
        if (result.skipped) {
          console.log(`    Skipped (exists): ${result.filePath}`);
        } else if (result.success) {
          console.log(`    Generated: ${result.filePath}`);
        } else {
          console.log(`    Failed: ${result.filePath} - ${result.error?.message}`);
        }
      }
    }
  }

  return results;
}

/**
 * Generate files from all datasources
 */
export async function generateAll(
  config: EmbedifyConfig,
  datasources: Record<string, Datasource>,
  options: {
    dryRun?: boolean;
    verbose?: boolean;
    datasourceName?: string;
    generatorName?: string;
  } = {}
): Promise<GenerateResult[]> {
  const results: GenerateResult[] = [];

  if (!config.datasources) {
    return results;
  }

  for (const [name, dsConfig] of Object.entries(config.datasources)) {
    // Filter by specific datasource if provided
    if (options.datasourceName && name !== options.datasourceName) {
      continue;
    }

    // Skip if no generators
    if (!dsConfig.generators || dsConfig.generators.length === 0) {
      continue;
    }

    const datasource = datasources[name];
    if (!datasource) {
      if (options.verbose) {
        console.warn(`Datasource not initialized: ${name}`);
      }
      continue;
    }

    if (options.verbose) {
      console.log(`\nProcessing datasource: ${name}`);
    }

    const dsResults = await generateFromDatasource(
      name,
      dsConfig,
      datasource,
      config,
      options
    );

    results.push(...dsResults);
  }

  return results;
}
