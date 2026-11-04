/**
 * ヒントの導出と一致の判定(GLOSSARY §2・§4)。
 */

import { isFilled, type Board, type Mark } from './board'
import type { Grid, Size } from './grid'
import type { Palette, PaletteIndex } from './palette'
import { EMPTY, visibleGrid, type Solution, type SolutionCell } from './solution'

/** 1つのブロックの記述。 */
export interface ClueEntry {
  readonly length: number
  readonly paletteIndex: PaletteIndex
}

/** 1ライン分のヒント。行は左→右、列は上→下。空ラインは []。 */
export type Clue = readonly ClueEntry[]

/** プレイモードが解答者に提示する問題。正解図は含まない。 */
export interface Puzzle {
  readonly size: Size
  readonly palette: Palette
  readonly rowClues: readonly Clue[]
  readonly columnClues: readonly Clue[]
}

/**
 * 1ラインのマスからヒントを導出する。`colorOf` は塗りなら PaletteIndex、背景なら null を返す。
 * 同じ色が続く間を1ブロックとする。違う色は隙間なしで隣接してよい。
 */
export function deriveClue<T>(line: readonly T[], colorOf: (cell: T) => PaletteIndex | null): Clue {
  const clue: ClueEntry[] = []
  let current = null as { length: number; paletteIndex: PaletteIndex } | null
  for (const cell of line) {
    const color = colorOf(cell)
    if (color !== null && current?.paletteIndex === color) {
      current.length++
      continue
    }
    if (current) clue.push(current)
    current = color === null ? null : { length: 1, paletteIndex: color }
  }
  if (current) clue.push(current)
  return clue
}

const solutionColor = (cell: SolutionCell): PaletteIndex | null => (cell === EMPTY ? null : cell)
const markColor = (mark: Mark): PaletteIndex | null => (isFilled(mark) ? mark : null)

function deriveAll<T>(grid: Grid<T>, colorOf: (cell: T) => PaletteIndex | null) {
  return {
    rowClues: grid.rows().map((line) => deriveClue(line, colorOf)),
    columnClues: grid.columns().map((line) => deriveClue(line, colorOf)),
  }
}

/** 正解図の可視領域からパズルを導出する。枠外のマスは使わない。 */
export function derivePuzzle(solution: Solution, palette: Palette): Puzzle {
  const grid = visibleGrid(solution)
  return { size: grid.size, palette, ...deriveAll(grid, solutionColor) }
}

/** 盤面から導出したヒント。バツと未記入はどちらも背景として扱う。 */
export function deriveBoardClues(board: Board): {
  rowClues: Clue[]
  columnClues: Clue[]
} {
  return deriveAll(board, markColor)
}

export function clueEquals(a: Clue, b: Clue): boolean {
  return (
    a.length === b.length &&
    a.every((e, i) => e.length === b[i]?.length && e.paletteIndex === b[i].paletteIndex)
  )
}

/** ラインごとの一致(satisfied)。 */
export interface Satisfaction {
  readonly rows: readonly boolean[]
  readonly columns: readonly boolean[]
}

export function satisfaction(board: Board, puzzle: Puzzle): Satisfaction {
  assertSameSize(board, puzzle)
  const derived = deriveBoardClues(board)
  return {
    rows: puzzle.rowClues.map((clue, i) => clueEquals(clue, derived.rowClues[i] ?? [])),
    columns: puzzle.columnClues.map((clue, i) => clueEquals(clue, derived.columnClues[i] ?? [])),
  }
}

/**
 * 解けた(solved): 全ラインのヒントが一致した。正解図との一致ではなくヒントとの一致で判定する
 * (別解で解いても解けた扱いにするため)。
 */
export function isSolved(board: Board, puzzle: Puzzle): boolean {
  const { rows, columns } = satisfaction(board, puzzle)
  return rows.every(Boolean) && columns.every(Boolean)
}

function assertSameSize(board: Board, puzzle: Puzzle): void {
  if (board.width !== puzzle.size.width || board.height !== puzzle.size.height) {
    throw new RangeError(
      `board ${board.width}x${board.height} does not match puzzle ${puzzle.size.width}x${puzzle.size.height}`,
    )
  }
}
