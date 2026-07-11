import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  resolve: { dedupe: ['three'] },
  plugins: [{
    name: 'assert-single-three-runtime',
    generateBundle(_, bundle) {
      const roots = new Set<string>();
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        for (const moduleId of Object.keys(output.modules)) {
          const match = moduleId.match(/^(.*\/node_modules\/(?:three|super-three))(?:\/|$)/u);
          if (match) roots.add(match[1]);
        }
      }
      if (roots.size !== 1 || [...roots][0]?.endsWith('/super-three')) {
        this.error(`Expected exactly one Three.js runtime, found: ${[...roots].join(', ') || 'none'}`);
      }
      console.log(`[AR build] single Three.js runtime: ${[...roots][0]}`);
    },
  }],
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    target: 'es2020',
  },
});
