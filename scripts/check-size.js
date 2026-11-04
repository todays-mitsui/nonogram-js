// player.js の gzip 後のサイズを確かめる(README §3.1 の目標: 30 KB 以下)。
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const LIMIT = 30 * 1024
const path = 'dist/player/v1/player.js'
const raw = readFileSync(path)
const gzipped = gzipSync(raw, { level: 9 }).length
const kb = (n) => `${(n / 1024).toFixed(1)} KB`
console.log(`${path}: ${kb(raw.length)} (gzip ${kb(gzipped)} / limit ${kb(LIMIT)})`)
if (gzipped > LIMIT) {
  console.error('player.js is over the size limit')
  process.exit(1)
}
