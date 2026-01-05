/**
 * Dependency Graph
 * Manage dependencies between documents, embeds, and datasources
 */

import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { glob } from 'glob';
import type {
  EmbedifyConfig,
  EmbedDefinition,
  TargetConfig,
} from '../types/index.js';
import { parseFrontmatter, parseMarkers, getCommentStyle } from './parser.js';

/**
 * Dependency type
 */
export type DependencyType = 'document' | 'embed' | 'datasource';

/**
 * Dependency node
 */
export interface DependencyNode {
  type: DependencyType;
  path: string;
  /** Paths this node depends on */
  dependsOn: Set<string>;
  /** Paths that depend on this node */
  dependedBy: Set<string>;
}

/**
 * Dependency graph
 */
export class DependencyGraph {
  private nodes: Map<string, DependencyNode> = new Map();
  private config: EmbedifyConfig;
  private embedsDir: string;
  private embeds: Record<string, EmbedDefinition>;

  constructor(
    config: EmbedifyConfig,
    embeds: Record<string, EmbedDefinition>
  ) {
    this.config = config;
    this.embeds = embeds;
    this.embedsDir = resolve(config.embeds_dir ?? './embeds');
  }

  /**
   * Get or create node
   */
  private getOrCreateNode(type: DependencyType, path: string): DependencyNode {
    const normalizedPath = resolve(path);
    let node = this.nodes.get(normalizedPath);

    if (!node) {
      node = {
        type,
        path: normalizedPath,
        dependsOn: new Set(),
        dependedBy: new Set(),
      };
      this.nodes.set(normalizedPath, node);
    }

    return node;
  }

  /**
   * Add dependency
   */
  private addDependency(fromPath: string, toPath: string): void {
    const fromNode = this.nodes.get(resolve(fromPath));
    const toNode = this.nodes.get(resolve(toPath));

    if (fromNode && toNode) {
      fromNode.dependsOn.add(toNode.path);
      toNode.dependedBy.add(fromNode.path);
    }
  }

  /**
   * Analyze document file and extract dependencies
   */
  async analyzeDocument(
    filePath: string,
    targetConfig: TargetConfig
  ): Promise<void> {
    const absolutePath = resolve(filePath);
    const docNode = this.getOrCreateNode('document', absolutePath);

    try {
      const content = await readFile(absolutePath, { encoding: 'utf-8' });
      const commentStyle = getCommentStyle(
        targetConfig.comment_style,
        this.config.comment_styles
      );

      // Parse frontmatter
      const { content: bodyContent } = parseFrontmatter(content);

      // Parse markers to extract embed names
      const markers = parseMarkers(bodyContent, commentStyle);
      const embedNames = new Set(markers.map((m) => m.templateName));

      // Add dependency for each embed
      for (const embedName of embedNames) {
        const embed = this.embeds[embedName];
        if (embed) {
          // Create embed node (virtual path)
          const embedPath = `embed:${embedName}`;
          const embedNode = this.getOrCreateNode('embed', embedPath);

          // Document -> Embed dependency
          docNode.dependsOn.add(embedNode.path);
          embedNode.dependedBy.add(docNode.path);

          // Embed -> Datasource dependency
          if (embed.dependsOn) {
            for (const dsName of embed.dependsOn) {
              const dsConfig = this.config.datasources?.[dsName];
              if (dsConfig?.path) {
                const dsPath = resolve(dsConfig.path);
                const dsNode = this.getOrCreateNode('datasource', dsPath);

                embedNode.dependsOn.add(dsNode.path);
                dsNode.dependedBy.add(embedNode.path);
              }
            }
          }
        }
      }
    } catch {
      // Ignore file read errors
    }
  }

  /**
   * Analyze all target files and build dependency graph
   */
  async build(): Promise<void> {
    this.nodes.clear();

    for (const targetConfig of this.config.targets) {
      const files = await glob(targetConfig.pattern, {
        ignore: targetConfig.exclude ?? [],
        nodir: true,
      });

      for (const filePath of files) {
        await this.analyzeDocument(filePath, targetConfig);
      }
    }
  }

  /**
   * Get all documents that depend on the specified path
   */
  getAffectedDocuments(changedPath: string): string[] {
    const normalizedPath = resolve(changedPath);
    const affected = new Set<string>();

    // Find changed node
    let startNode = this.nodes.get(normalizedPath);

    // If datasource file, search by path
    if (!startNode) {
      for (const node of this.nodes.values()) {
        if (node.type === 'datasource' && node.path === normalizedPath) {
          startNode = node;
          break;
        }
      }
    }

    // If embed file (.ts file)
    if (!startNode && changedPath.endsWith('.ts')) {
      // Infer embed name from filename
      const fileName = changedPath.split('/').pop()?.replace('.ts', '');
      if (fileName && fileName !== 'index') {
        const embedPath = `embed:${fileName}`;
        startNode = this.nodes.get(resolve(embedPath));

        // Try snake_case/camelCase conversion
        if (!startNode) {
          const snakeCase = fileName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
          startNode = this.nodes.get(resolve(`embed:${snakeCase}`));
        }
      }
    }

    if (!startNode) {
      // If not found, check if changed file itself is a document
      const docNode = this.nodes.get(normalizedPath);
      if (docNode?.type === 'document') {
        return [normalizedPath];
      }
      return [];
    }

    // BFS to find dependent documents
    const visited = new Set<string>();
    const queue: DependencyNode[] = [startNode];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(current.path)) {
        continue;
      }
      visited.add(current.path);

      // Add to result if document
      if (current.type === 'document') {
        affected.add(current.path);
      }

      // Add nodes that depend on this node to queue
      for (const dependedByPath of current.dependedBy) {
        const dependedByNode = this.nodes.get(dependedByPath);
        if (dependedByNode && !visited.has(dependedByPath)) {
          queue.push(dependedByNode);
        }
      }
    }

    return Array.from(affected);
  }

  /**
   * Get paths to watch (datasources, embeds directory)
   */
  getWatchPaths(): string[] {
    const paths: string[] = [];

    // Datasource paths
    if (this.config.datasources) {
      for (const dsConfig of Object.values(this.config.datasources)) {
        if (dsConfig.path) {
          paths.push(resolve(dsConfig.path));
        }
      }
    }

    // Embeds directory
    paths.push(this.embedsDir);

    return paths;
  }

  /**
   * Debug: Dump graph state
   */
  dump(): void {
    console.log('\n=== Dependency Graph ===');
    for (const [path, node] of this.nodes) {
      console.log(`\n[${node.type}] ${relative(process.cwd(), path)}`);
      if (node.dependsOn.size > 0) {
        console.log('  depends on:');
        for (const dep of node.dependsOn) {
          console.log(`    - ${relative(process.cwd(), dep)}`);
        }
      }
      if (node.dependedBy.size > 0) {
        console.log('  depended by:');
        for (const dep of node.dependedBy) {
          console.log(`    - ${relative(process.cwd(), dep)}`);
        }
      }
    }
  }
}
