import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    external: ['react', 'emailmd'],
    // Everything in this package is client-side (hooks, iframes, editors).
    banner: { js: '"use client";' },
  },
  {
    entry: ['src/styles.css'],
    clean: false,
  },
]);
