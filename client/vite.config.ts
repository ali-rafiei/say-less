import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@say-less/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: { '/ws': { target: 'ws://localhost:8080', ws: true } },
  },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
});
