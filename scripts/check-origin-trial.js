// editor/index.html のオリジントライアルのトークンの期限を読む。
// 期限まで DAYS 日を切っていたら、GitHub Actions の出力 `expiring=true` を書く。
import { appendFileSync, readFileSync } from 'node:fs'

const DAYS = 30
const html = readFileSync('editor/index.html', 'utf8')
const tokens = [...html.matchAll(/http-equiv="origin-trial"\s+content="([^"]+)"/g)].map((m) => m[1])
const now = Date.now()
let expiring = false
const lines = []
for (const token of tokens) {
  const bytes = Buffer.from(token, 'base64')
  const payload = JSON.parse(bytes.subarray(bytes.indexOf('{')).toString('utf8'))
  const expiry = new Date(payload.expiry * 1000)
  const daysLeft = Math.floor((expiry.getTime() - now) / 86_400_000)
  lines.push(
    `- ${payload.feature} (${payload.origin}): ${expiry.toISOString().slice(0, 10)} まで、残り ${daysLeft} 日`,
  )
  if (daysLeft <= DAYS) expiring = true
}
console.log(lines.join('\n'))
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `expiring=${expiring}\nsummary<<EOF\n${lines.join('\n')}\nEOF\n`,
  )
}
