import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteStaticCopy } from 'vite-plugin-static-copy'


// https://vitejs.dev/config/
export default defineConfig({
	base: "https://rwnx.github.io/scrunked/",
	plugins: [
    preact(),
    viteStaticCopy({
      targets: [
        {
          src: 'CHANGELOG.md',
          dest: ''
        }
      ]
    })
  ],
});
