/**
 * 書き出しと読み込み(README §5.1)。
 */

import { decodeSolution, encodeSolution, SolutionCodeError } from '../core/format'
import { crop } from '../core/solution'
import { editor as t, fallback } from '../i18n/ja'
import type { AspectRatio } from '../player/widget'
import { MAX_COLORS, type EditorDoc } from './commands'

export const PLAYER_URL = 'https://todays-mitsui.github.io/nonogram-js/player/v1/player.js'

/** 作問側の保存の正解図コード(枠外のマスも残す)。 */
export function encodeDoc(doc: EditorDoc): Promise<string> {
  return encodeSolution(doc.solution, doc.palette)
}

/** 書き出し: 切り抜いた正解図コード。 */
export function exportCode(doc: EditorDoc): Promise<string> {
  return encodeSolution(crop(doc.solution), doc.palette)
}

/** 書き出し: 埋め込みタグ(docs/spec/EMBED.md)。 */
export async function exportEmbedTag(doc: EditorDoc, aspectRatio: AspectRatio): Promise<string> {
  const code = await exportCode(doc)
  return (
    `<div class="todays-mitsui__nonogram" data-solution="${code}" data-aspect-ratio="${aspectRatio}">${fallback}</div>\n` +
    `<script src="${PLAYER_URL}" defer></script>`
  )
}

export type ImportResult =
  | { readonly ok: true; readonly doc: EditorDoc; readonly code: string }
  | { readonly ok: false; readonly message: string }

/** 貼り付けられた文字列から正解図コードを取り出す。埋め込みタグなら data-solution の値。 */
export function extractCode(text: string): string {
  const match = /data-solution\s*=\s*(["'])(.*?)\1/s.exec(text)
  return (match ? match[2] : text)!.trim()
}

/** 正解図コード、または埋め込みタグを読み込む。17 色以上は読み込まない。 */
export async function importText(text: string): Promise<ImportResult> {
  const code = extractCode(text)
  try {
    const { solution, palette } = await decodeSolution(code)
    if (palette.length > MAX_COLORS) {
      return { ok: false, message: t.import.tooManyColors(palette.length) }
    }
    return { ok: true, doc: { solution, palette }, code }
  } catch (error) {
    if (error instanceof SolutionCodeError) {
      return { ok: false, message: t.import.invalidCode(error.reason) }
    }
    throw error
  }
}

/** URL の # に載せる形。`#` を含むのでエンコードする。 */
export function toHash(code: string): string {
  return `#${encodeURIComponent(code)}`
}

export function fromHash(hash: string): string | null {
  const body = hash.replace(/^#/, '')
  if (body === '') return null
  try {
    return decodeURIComponent(body)
  } catch {
    return body
  }
}
