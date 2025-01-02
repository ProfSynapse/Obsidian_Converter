// vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: {
			'$lib': fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	},
	server: {
		port: 5173,
		strictPort: false,
	},
	build: {
		outDir: 'build',
		target: 'esnext',
		sourcemap: true,
	},
	optimizeDeps: {
		exclude: ['@smui/button', '@smui/textfield']
	}
});