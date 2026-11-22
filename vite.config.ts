import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = 'http://127.0.0.1:4317';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    // The editor chunk contains Excalidraw and is lazy-loaded, so its size is expected.
    chunkSizeWarningLimit: 1500,
  },
});
