import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from '../src/core/dependency.js';
import type { EmbedifyConfig, EmbedDefinition } from '../src/types/index.js';

describe('DependencyGraph', () => {
  let config: EmbedifyConfig;
  let embeds: Record<string, EmbedDefinition>;

  beforeEach(() => {
    config = {
      version: '1.0',
      targets: [
        {
          pattern: './docs/**/*.md',
          comment_style: 'html',
        },
      ],
      datasources: {
        metadata_db: {
          type: 'sqlite',
          path: './data/sample.db',
        },
        api_endpoints: {
          type: 'csv',
          path: './data/api_endpoints.csv',
        },
      },
      embeds_dir: './embeds',
    };

    embeds = {
      table_columns: {
        dependsOn: ['metadata_db'],
        async render() {
          return { content: '' };
        },
      },
      api_list: {
        dependsOn: ['api_endpoints'],
        async render() {
          return { content: '' };
        },
      },
      code_snippet: {
        // No datasource dependencies
        async render() {
          return { content: '' };
        },
      },
    };
  });

  describe('constructor', () => {
    it('should create instance with config and embeds', () => {
      const graph = new DependencyGraph(config, embeds);
      expect(graph).toBeInstanceOf(DependencyGraph);
    });
  });

  describe('getWatchPaths', () => {
    it('should return datasource paths and embeds directory', () => {
      const graph = new DependencyGraph(config, embeds);
      const paths = graph.getWatchPaths();

      expect(paths.length).toBeGreaterThan(0);
      expect(paths.some((p) => p.includes('sample.db'))).toBe(true);
      expect(paths.some((p) => p.includes('api_endpoints.csv'))).toBe(true);
      expect(paths.some((p) => p.includes('embeds'))).toBe(true);
    });

    it('should handle config without datasources', () => {
      const configNoDatasources: EmbedifyConfig = {
        version: '1.0',
        targets: [],
        embeds_dir: './embeds',
      };
      const graph = new DependencyGraph(configNoDatasources, {});
      const paths = graph.getWatchPaths();

      expect(paths.some((p) => p.includes('embeds'))).toBe(true);
    });
  });

  describe('getAffectedDocuments', () => {
    it('should return empty array when no graph is built', () => {
      const graph = new DependencyGraph(config, embeds);
      const affected = graph.getAffectedDocuments('./data/sample.db');

      expect(affected).toEqual([]);
    });
  });
});

