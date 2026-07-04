import { defineConfig } from 'tsup';
import { version } from './package.json';

// Compile-time version stamp, so dist never depends on reading package.json
// at runtime (which breaks when the module is bundled, e.g. by Next.js).
const define = { EMAILMD_VERSION: JSON.stringify(version) };

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/mcp.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    define,
  },
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    banner: { js: '#!/usr/bin/env node' },
    clean: false,
    define,
  },
]);
