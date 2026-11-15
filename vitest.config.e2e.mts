import path from 'node:path';

import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: false,
  resolve: {
    alias: {
      'class-transformer': path.resolve(
        import.meta.dirname,
        'node_modules/class-transformer/cjs/index.js',
      ),
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['e2e/specs/**/*.e2e-spec.ts'],
    globalSetup: ['e2e/src/runner/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 60000,
    hookTimeout: 120000,
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
