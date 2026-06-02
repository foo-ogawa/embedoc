#!/usr/bin/env node
import { build } from "esbuild";
import { readFileSync, statSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const minify = process.argv.includes("--minify");

// Native modules and runtime-needed packages must stay external.
// tsx resolves loader paths via import.meta.url relative to its package
// directory and cannot be inlined into a single-file bundle.
const externalPackages = [
  "better-sqlite3",
  "tsx",
];

const inlineBuildTimeConstants = {
  name: "inline-build-time-constants",
  setup(build) {
    build.onLoad({ filter: /src[\\/]cli\.ts$/ }, async (args) => {
      let contents = readFileSync(args.path, "utf8");
      // Strip shebang
      contents = contents.replace(/^#!.*\n/, "");
      // Replace runtime package.json read with build-time constant
      // Pattern: createRequire + require('../package.json')
      contents = contents.replace(
        /const require = createRequire\(import\.meta\.url\);\nconst pkg = require\(['"]\.\.\/package\.json['"]\).*;\n/,
        `const pkg = { version: ${JSON.stringify(pkg.version)} };\n`,
      );
      return { contents, loader: "ts" };
    });
  },
};

const result = await build({
  entryPoints: ["src/cli.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  outfile: "dist/embedoc.bundle.mjs",
  minify,
  sourcemap: true,
  external: externalPackages,
  mainFields: ["module", "main"],
  conditions: ["import", "node"],
  banner: {
    js: [
      "#!/usr/bin/env node",
      "import { createRequire } from 'module';",
      "const require = createRequire(import.meta.url);",
    ].join("\n"),
  },
  plugins: [inlineBuildTimeConstants],
  logLevel: "info",
});

if (result.errors.length > 0) process.exit(1);
const stat = statSync("dist/embedoc.bundle.mjs");
const sizeKB = (stat.size / 1024).toFixed(1);
const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
console.log(`\n✓ dist/embedoc.bundle.mjs  ${sizeKB} KB (${sizeMB} MB)`);
