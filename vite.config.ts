import { defineConfig } from 'vite';

// Static SPA build consumed by Cloudflare Workers Static Assets (see wrangler.jsonc).
// Keep the bundle lean: this is a microsite (<80kb JS budget per project perf rules).
export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
});
