import { readFile } from 'node:fs/promises';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = 'http://127.0.0.1:4317';

/**
 * Excalidraw falls back to esm.sh for any font it cannot find locally. The app's Content
 * Security Policy blocks that, but the attempt would still contact a third party, so the
 * fallback is pointed at this server instead. A missing font then fails locally.
 */
function keepExcalidrawFontsLocal(): Plugin {
  return {
    name: 'keep-excalidraw-fonts-local',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('@excalidraw/excalidraw/dist/')) return null;
      if (!code.includes('`https://esm.sh/${')) {
        // A new Excalidraw release that changes this code would silently bring esm.sh back.
        if (code.includes('ASSETS_FALLBACK_URL')) {
          this.warn('Excalidraw fallback font URL has changed; check keepExcalidrawFontsLocal.');
        }
        return null;
      }
      return {
        code: code.replaceAll('`https://esm.sh/${', '`${window.location.origin}/${'),
        map: null,
      };
    },
  };
}

export default defineConfig({
  plugins: [keepExcalidrawFontsLocal(), react()],
  // Dev pre-bundling: apply the same font rewrite to Excalidraw files as they are pre-bundled.
  optimizeDeps: {
    esbuildOptions: {
      plugins: [
        {
          name: 'keep-excalidraw-fonts-local-prebundle',
          setup(build) {
            build.onLoad({ filter: /@excalidraw\/excalidraw\/dist\/.*\.js$/ }, async (args) => {
              const code = await readFile(args.path, 'utf8');
              if (!code.includes('`https://esm.sh/${')) return undefined;
              return {
                contents: code.replaceAll('`https://esm.sh/${', '`${window.location.origin}/${'),
                loader: 'js',
              };
            });
          },
        },
      ],
    },
  },
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
