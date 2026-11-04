/**
 * エディタの状態を変えるコマンド(README §5.3)。DOM に依存しない純粋な関数。
 * UI と WebMCP はどちらもこれを呼ぶ。1回の呼び出しがアンドゥ1回分になる(history.ts)。
 * 入力が不正なら EditorCommandError を投げ、状態は変えない。
 */

import type { Point } from '../core/grid'
import { KEEP, parseRows, RowsError } from './rows'
import { isPaletteColor, type Palette, type PaletteColor } from '../core/palette'
import {
  EMPTY,
  emptySolution,
  resizeFrame,
  trimToExtent,
  type Solution,
  type SolutionCell,
} from '../core/solution'

/** 作品の中身。正解図(データ領域ごと)とパレット。 */
export interface EditorDoc {
  readonly solution: Solution
  readonly palette: Palette
}

export const MIN_SIZE = 5
export const MAX_SIZE = 100
export const MAX_COLORS = 16
export const DEFAULT_SIZE = 15
export const DEFAULT_COLOR = '#000'

export class EditorCommandError extends Error {
  override readonly name = 'EditorCommandError'
}

/** 新規作成: 15x15・黒1色。 */
export function newDoc(): EditorDoc {
  return { solution: emptySolution(DEFAULT_SIZE, DEFAULT_SIZE), palette: [DEFAULT_COLOR] }
}

export function setSize(doc: EditorDoc, width: number, height: number): EditorDoc {
  for (const [name, value] of [
    ['width', width],
    ['height', height],
  ] as const) {
    if (!Number.isInteger(value) || value < MIN_SIZE || value > MAX_SIZE) {
      throw new EditorCommandError(`${name} must be an integer from ${MIN_SIZE} to ${MAX_SIZE}`)
    }
  }
  return { ...doc, solution: resizeFrame(doc.solution, { width, height }) }
}

export function addColor(doc: EditorDoc, color: PaletteColor): EditorDoc {
  assertColor(color)
  if (doc.palette.length >= MAX_COLORS) {
    throw new EditorCommandError(`the palette can have at most ${MAX_COLORS} colors`)
  }
  return { ...doc, palette: [...doc.palette, color] }
}

export function updateColor(doc: EditorDoc, index: number, color: PaletteColor): EditorDoc {
  assertIndex(doc, index)
  assertColor(color)
  return { ...doc, palette: doc.palette.map((c, i) => (i === index ? color : c)) }
}

/** 色を削除する。その色のマスは背景にし、後ろの色の PaletteIndex を詰める。最後の1色は消せない。 */
export function removeColor(doc: EditorDoc, index: number): EditorDoc {
  assertIndex(doc, index)
  if (doc.palette.length <= 1) throw new EditorCommandError('the palette needs at least one color')
  return {
    palette: doc.palette.filter((_, i) => i !== index),
    solution: remap(doc.solution, (cell) =>
      cell === EMPTY || cell < index ? cell : cell === index ? EMPTY : cell - 1,
    ),
  }
}

/** 色を `from` から `to` の位置へ動かす。正解図の PaletteIndex も振り直す。 */
export function moveColor(doc: EditorDoc, from: number, to: number): EditorDoc {
  assertIndex(doc, from)
  assertIndex(doc, to)
  if (from === to) return doc
  const order = doc.palette.map((_, i) => i)
  order.splice(to, 0, ...order.splice(from, 1))
  // order[新しい位置] = 古い位置
  const newIndexOf = new Map(order.map((oldIndex, newIndex) => [oldIndex, newIndex]))
  return {
    palette: order.map((i) => doc.palette[i] as PaletteColor),
    solution: remap(doc.solution, (cell) =>
      cell === EMPTY ? cell : (newIndexOf.get(cell) as number),
    ),
  }
}

/** 指定したマスを1つの値にする。可視領域の外を指したらエラー。 */
export function paintCells(
  doc: EditorDoc,
  points: readonly Point[],
  value: SolutionCell,
): EditorDoc {
  if (value !== EMPTY) assertIndex(doc, value)
  const { frame } = doc.solution
  for (const { x, y } of points) {
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      y < 0 ||
      x >= frame.width ||
      y >= frame.height
    ) {
      throw new EditorCommandError(
        `(${x}, ${y}) is outside the ${frame.width}x${frame.height} frame`,
      )
    }
  }
  const grid = doc.solution.grid.setMany(points.map(({ x, y }) => ({ x, y, value })))
  if (grid === doc.solution.grid) return doc
  return { ...doc, solution: trimToExtent({ grid, frame }) }
}

/**
 * 行文字列(rows.ts)を `(x, y)` を左上として書き込む。`-` のマスは変えない。
 * 可視領域からはみ出したら、何も変えずにエラー。
 */
export function drawRows(doc: EditorDoc, x: number, y: number, rows: readonly string[]): EditorDoc {
  const { frame } = doc.solution
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
    throw new EditorCommandError(`(${x}, ${y}) must be non-negative integers`)
  }
  let cells
  try {
    cells = parseRows(rows, doc.palette.length)
  } catch (error) {
    if (error instanceof RowsError) throw new EditorCommandError(error.message)
    throw error
  }
  const width = Math.max(0, ...cells.map((row) => row.length))
  if (x + width > frame.width || y + cells.length > frame.height) {
    throw new EditorCommandError(
      `a ${width}x${cells.length} block at (${x}, ${y}) does not fit in the ${frame.width}x${frame.height} frame`,
    )
  }
  const updates = cells.flatMap((row, dy) =>
    row.flatMap((value, dx) => (value === KEEP ? [] : [{ x: x + dx, y: y + dy, value }])),
  )
  const grid = doc.solution.grid.setMany(updates)
  if (grid === doc.solution.grid) return doc
  return { ...doc, solution: trimToExtent({ grid, frame }) }
}

/** 全マスを背景にする(枠外も含む)。 */
export function clear(doc: EditorDoc): EditorDoc {
  const { width, height } = doc.solution.frame
  return { ...doc, solution: emptySolution(width, height) }
}

/** その色で塗られたマスの数(色の削除の確認に使う)。 */
export function countCells(doc: EditorDoc, index: number): number {
  return doc.solution.grid.toCells().filter((cell) => cell === index).length
}

function remap(solution: Solution, fn: (cell: SolutionCell) => SolutionCell): Solution {
  return trimToExtent({ grid: solution.grid.map((cell) => fn(cell)), frame: solution.frame })
}

function assertColor(color: string): void {
  if (!isPaletteColor(color)) {
    throw new EditorCommandError(`"${color}" is not a color (#RGB or #RRGGBB)`)
  }
}

function assertIndex(doc: EditorDoc, index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= doc.palette.length) {
    throw new EditorCommandError(
      `color index ${index} is not in the palette (0 to ${doc.palette.length - 1})`,
    )
  }
}
