// Build of the 3D proof of concept only (poc.html), to measure its download size.
// The game build (vite.config.ts) and the deploy are untouched.
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { outDir: 'dist-poc', rollupOptions: { input: 'poc.html' }, chunkSizeWarningLimit: 4000 },
});
