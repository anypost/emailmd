import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    // Builder smoke tests mount CodeMirror + run full mjml renders; give them
    // headroom when the machine is under parallel load. Must stay above the
    // asyncUtilTimeout set in tests/setup.ts.
    testTimeout: 60000,
    setupFiles: ['./tests/setup.ts'],
  },
});
