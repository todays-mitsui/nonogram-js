/**
 * パズル領域のレイアウト(docs/spec/LAYOUT.md)。DOM に依存しない純粋な計算。
 * キャンバスに使える大きさを受け取り、その中に置くパズル領域(ヒント領域 + マス領域)の寸法を決める。
 *
 * ヒント項目1つにマス1つ分の場所を割り当てる。行ヒント領域の幅は「いちばん項目の多い行の項目数」マス分、
 * 列ヒント領域の高さは「いちばん項目の多い列の項目数」マス分(空ラインの「0」も1項目に数える)。
 */

import type { Clue, ClueEntry, Puzzle } from '../core/clue'
import type { Point } from '../core/grid'

export const MIN_CELL_SIZE = 16
export const MAX_CELL_SIZE = 40

export interface Layout {
  readonly cellSize: number
  /** 行ヒント領域の項目数(マス数)。 */
  readonly rowClueSlots: number
  /** 列ヒント領域の項目数(マス数)。 */
  readonly columnClueSlots: number
  /** マス領域の左上(パズル領域の左上からの CSS px)。左はヒント領域の幅、上は列ヒント領域の高さと同じ。 */
  readonly cellAreaX: number
  readonly cellAreaY: number
  /** パズル領域の大きさ(CSS px)。<canvas> 要素の大きさになる。 */
  readonly puzzleAreaWidth: number
  readonly puzzleAreaHeight: number
  /** 下限の cellSize でも収まらず、キャンバスの中でスクロールが要るか。 */
  readonly overflows: boolean
}

const slots = (clues: readonly Clue[]) => Math.max(1, ...clues.map((c) => c.length))

/** `available` はキャンバスの大きさ(スクロールバーの分を除く)。 */
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
  const puzzleAreaWidth = columns * cellSize
  const puzzleAreaHeight = rows * cellSize
  return {
    cellSize,
    rowClueSlots,
    columnClueSlots,
    cellAreaX: rowClueSlots * cellSize,
    cellAreaY: columnClueSlots * cellSize,
    puzzleAreaWidth,
    puzzleAreaHeight,
    overflows: puzzleAreaWidth > available.width || puzzleAreaHeight > available.height,
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

/**
 * キャンバス内の座標にあるヒント項目。項目が右(下)寄せで並ぶのは draw と同じ。
 * ヒント領域の外、項目のない場所、空ラインの「0」なら null。
 */
export function clueEntryAt(
  layout: Layout,
  puzzle: Puzzle,
  x: number,
  y: number,
): ClueEntry | null {
  const s = layout.cellSize
  const cx = Math.floor((x - layout.cellAreaX) / s)
  const cy = Math.floor((y - layout.cellAreaY) / s)
  // 行ヒント: マス領域の左。cx は -1(マス領域のすぐ左)から負に数える
  if (cx < 0 && cy >= 0 && cy < puzzle.size.height) {
    const clue = puzzle.rowClues[cy] as Clue
    return clue[clue.length + cx] ?? null
  }
  if (cy < 0 && cx >= 0 && cx < puzzle.size.width) {
    const clue = puzzle.columnClues[cx] as Clue
    return clue[clue.length + cy] ?? null
  }
  return null
}
