// vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';

export default defineConfig(({ mode }) => ({
  plugins: [sveltekit()],
  envPrefix: 'VITE_',
  resolve: {
    alias: {
      '$lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
    }
  },
  server: {
    port: process.env.PORT || 5173,  // Railway will provide PORT
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.RAILWAY_API_BASE_URL || 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  build: {
    outDir: 'build',
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      external: [/^@sveltejs\/kit/, 'archiver']
    }
  },
  optimizeDeps: {
    include: ['@sveltejs/kit']
  },
  ssr: {
    noExternal: ['@sveltejs/kit']
  }
}));
