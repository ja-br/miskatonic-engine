import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: __dirname,
  base: './',
  publicDir: path.resolve(__dirname, '../../public'),
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        phase0: path.resolve(__dirname, 'phase0-validation.html'),
        modelViewer: path.resolve(__dirname, 'model-viewer.html'),
      },
      external: [
        // Exclude ShaderLoader (Node.js-only) from browser bundle
        /ShaderLoader/,
      ],
    },
  },
  resolve: {
    alias: {
      '@miskatonic/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
