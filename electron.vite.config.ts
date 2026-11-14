import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

const alias = {
  '@core': resolve('src/core'),
  '@shared': resolve('src/shared'),
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
  },
  preload: {
    // O preload roda em sandbox (sem require de node_modules): o zod vai embutido.
    plugins: [externalizeDepsPlugin({ exclude: ['zod'] })],
    resolve: { alias },
    build: { rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } } },
  },
  renderer: {
    root: 'src/renderer',
    resolve: { alias: { ...alias, '@renderer': resolve('src/renderer') } },
    plugins: [vue()],
    build: { rollupOptions: { input: resolve('src/renderer/index.html') } },
  },
})
