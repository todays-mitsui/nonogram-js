/**
 * 進捗コード p1 とパズル ID(docs/spec/PROGRESS.md)。
 *
 *   p1;{幅}x{高さ};{revealed};{マスデータ}
 */

import { BLANK, CROSSED, type Board, type Mark } from './board'
import { decodeCells, encodeCells } from './cells-codec'
import type { Clue, Puzzle } from './clue'
import { Grid } from './grid'

export const PROGRESS_FORMAT_VERSION = 'p1'

/** 保存キーの接頭辞。一度配ったら変えない(変えると解答者の進捗が消える)。 */
export const STORAGE_PREFIX = 'todays-mitsui/nonogram:'

/** 解いている途中の状態全体。解けた(solved)は盤面から導出できるので持たない。 */
export interface Progress {
  readonly board: Board
  readonly revealed: boolean
}

export type PuzzleId = string

export function storageKey(id: PuzzleId): string {
  return `${STORAGE_PREFIX}progress:${id}`
}

/** パズル ID の入力の正規形。ヒントだけから作り、色の値も色数も含めない。 */
export function puzzleIdInput(puzzle: Puzzle): string {
  const clues = (lines: readonly Clue[]) =>
    lines.map((clue) => clue.map((e) => `${e.length}:${e.paletteIndex}`).join(',')).join('/')
  const { width, height } = puzzle.size
  return `${width}x${height};${clues(puzzle.rowClues)};${clues(puzzle.columnClues)}`
}

/** SHA-256 の16進小文字。`crypto.subtle` がない環境(非 HTTPS など)では reject する。 */
export async function computePuzzleId(puzzle: Puzzle): Promise<PuzzleId> {
  const data = new TextEncoder().encode(puzzleIdInput(puzzle))
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function encodeProgress(progress: Progress): Promise<string> {
  const { board, revealed } = progress
  const bytes = Uint8Array.from(board.toCells(), (mark) => {
    if (mark === BLANK) return 0
    if (mark === CROSSED) return 1
    return mark + 2
  })
  return [
    PROGRESS_FORMAT_VERSION,
    `${board.width}x${board.height}`,
    revealed ? '1' : '0',
    await encodeCells(bytes),
  ].join(';')
}

/**
 * 進捗コードを読む。PROGRESS.md「復元時に捨てる条件」に当てはまるときは null を返す
 * (エラーにはしない。呼び出し側は全マス未記入から始める)。
 */
export async function decodeProgress(code: string, puzzle: Puzzle): Promise<Progress | null> {
  const fields = code.split(';')
  if (fields.length !== 4) return null
  const [version, size, revealed, cells] = fields as [string, string, string, string]
  if (version !== PROGRESS_FORMAT_VERSION) return null

  const { width, height } = puzzle.size
  if (size !== `${width}x${height}`) return null
  if (revealed !== '0' && revealed !== '1') return null

  let bytes: Uint8Array
  try {
    bytes = await decodeCells(cells)
  } catch {
    return null
  }
  if (bytes.length !== width * height) return null
  if (bytes.some((b) => b >= puzzle.palette.length + 2)) return null

  const marks = Array.from(bytes, (b): Mark => (b === 0 ? BLANK : b === 1 ? CROSSED : b - 2))
  return { board: Grid.fromCells(width, height, marks), revealed: revealed === '1' }
}
