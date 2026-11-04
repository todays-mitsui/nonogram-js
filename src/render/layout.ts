/**
 * キャンバスのレイアウト(README §4.2)。DOM に依存しない純粋な計算。
 *
 * ヒント項目1つにマス1つ分の場所を割り当てる。行ヒント領域の幅は「いちばん項目の多い行の項目数」マス分、
 * 列ヒント領域の高さは「いちばん項目の多い列の項目数」マス分(空ラインの「0」も1項目に数える)。
 */

import type { Clue, Puzzle } from '../core/clue'
import type { Point } from '../core/grid'

export const MIN_CELL_SIZE = 16
export const MAX_CELL_SIZE = 40

export interface Layout {
  readonly cellSize: number
  /** 行ヒント領域の項目数(マス数)。 */
  readonly rowClueSlots: number
  /** 列ヒント領域の項目数(マス数)。 */
  readonly columnClueSlots: number
  /** マス領域の左上(キャンバス内の CSS px)。 */
  readonly cellAreaX: number
  readonly cellAreaY: number
  /** キャンバス全体の大きさ(CSS px)。 */
  readonly width: number
  readonly height: number
  /** 下限の cellSize でも収まらず、スクロールが要るか。 */
  readonly overflows: boolean
}

const slots = (clues: readonly Clue[]) => Math.max(1, ...clues.map((c) => c.length))

/** `available` はキャンバスに使える大きさ(ウィジェットからツールバーなどを除いた残り)。 */
export function computeLayout(
  puzzle: Puzzle,
  available: { width: number; height: number },
): Layout {
  const rowClueSlots = slots(puzzle.rowClues)
  const columnClueSlots = slots(puzzle.columnClues)
  const columns = rowClueSlots + puzzle.size.width
  const rows = columnClueSlots + puzzle.size.height
  const fit = Math.floor(Math.min(available.width / columns, available.height / rows))
  const cellSize = Math.min(MAX_CELL_SIZE, Math.max(MIN_CELL_SIZE, fit))
  const width = columns * cellSize
  const height = rows * cellSize
  return {
    cellSize,
    rowClueSlots,
    columnClueSlots,
    cellAreaX: rowClueSlots * cellSize,
    cellAreaY: columnClueSlots * cellSize,
    width,
    height,
    overflows: width > available.width || height > available.height,
  }
}

/** キャンバス内の座標(CSS px)をマスの座標にする。マス領域の外なら null。 */
export function cellAt(layout: Layout, puzzle: Puzzle, x: number, y: number): Point | null {
  const cx = Math.floor((x - layout.cellAreaX) / layout.cellSize)
  const cy = Math.floor((y - layout.cellAreaY) / layout.cellSize)
  if (cx < 0 || cy < 0 || cx >= puzzle.size.width || cy >= puzzle.size.height) return null
  return { x: cx, y: cy }
}

/** マス領域の外も含めて、キャンバス内の座標をマスの座標にする(ストロークの途中で使う。範囲への寄せは Stroke が行う)。 */
export function cellAtUnclamped(layout: Layout, x: number, y: number): Point {
  return {
    x: Math.floor((x - layout.cellAreaX) / layout.cellSize),
    y: Math.floor((y - layout.cellAreaY) / layout.cellSize),
  }
}
