import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter(),
    alias: {
      $lib: path.resolve('./src/lib'),
      $components: path.resolve('./src/lib/components'),
      $stores: path.resolve('./src/lib/stores'),
      $utils: path.resolve('./src/lib/utils'),
      $styles: path.resolve('./src/lib/styles')
    }
  }
};

export default config;