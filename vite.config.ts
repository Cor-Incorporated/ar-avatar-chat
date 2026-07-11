import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  resolve: { dedupe: ['three'] },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    target: 'es2020',
  },
});
