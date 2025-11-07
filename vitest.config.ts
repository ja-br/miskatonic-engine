import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.config.*', '**/tests/**'],
    },
  },
  resolve: {
    alias: {
      '@miskatonic/shared': path.resolve(__dirname, 'packages/shared/src'),
      '@miskatonic/main': path.resolve(__dirname, 'packages/main/src'),
      '@miskatonic/preload': path.resolve(__dirname, 'packages/preload/src'),
    },
  },
});
