// vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
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