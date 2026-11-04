import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const { version } = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8'))

// 埋め込み用の player.js。依存なしの IIFE 単一ファイル(docs/spec/EMBED.md)。
// グローバルの window.TodaysMitsuiNonogram はエントリ自身が二重読み込みを確かめてから置く。
// エントリは何も export しないので、lib.name(iife では必須)のグローバル変数は作られない。
export default defineConfig({
  define: {
    __PLAYER_VERSION__: JSON.stringify(version),
  },
  build: {
    outDir: 'dist/player/v1',
    emptyOutDir: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/player/index.ts'),
      formats: ['iife'],
      name: 'TodaysMitsuiNonogramBundle',
      fileName: () => 'player.js',
    },
  },
})
