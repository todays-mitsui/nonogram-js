import { resolve } from 'node:path'
import preact from '@preact/preset-vite'
import { defineConfig } from 'vitest/config'

// GitHub Pages のサイト全体(トップ = エディタ、旧 /editor/ の転送、デモ、使い方)を作る。
// player.js は vite.player.config.ts で別にビルドし、dist/player/v1/ に足す。
export default defineConfig({
  base: '/nonogram-js/',
  plugins: [preact()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        editor: resolve(import.meta.dirname, 'editor/index.html'),
        demo: resolve(import.meta.dirname, 'demo/index.html'),
        guide: resolve(import.meta.dirname, 'guide/index.html'),
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
