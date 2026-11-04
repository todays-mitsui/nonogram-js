/**
 * 行文字列(README §5.3)。WebMCP のツールの入出力で正解図を表す。
 *
 * | 文字                | 意味                                       |
 * |---------------------|--------------------------------------------|
 * | `.`                 | 背景                                       |
 * | `1`〜`9`、`a`〜`g`  | 表示番号(PaletteIndex + 1)。`g` = 色16   |
 * | `-`                 | 変更しない(書き込み時のみ)               |
 */

import type { Grid } from '../core/grid'
import type { PaletteIndex } from '../core/palette'
import { EMPTY, type SolutionCell } from '../core/solution'

const DIGITS = '123456789abcdefg'
export const KEEP = 'keep'
export type RowCell = SolutionCell | typeof KEEP

export class RowsError extends Error {
  override readonly name = 'RowsError'
}

export function toRowChar(cell: SolutionCell): string {
  if (cell === EMPTY) return '.'
  const c = DIGITS[cell]
  if (c === undefined)
    throw new RangeError(`color index ${cell} cannot be written as a row character`)
  return c
}

export function toRows(grid: Grid<SolutionCell>): string[] {
  return grid.rows().map((row) => row.map(toRowChar).join(''))
}

/** 行文字列を読む。`paletteSize` を超える色、未知の文字はエラー。行の長さは揃っていなくてよい。 */
export function parseRows(rows: readonly string[], paletteSize: number): RowCell[][] {
  return rows.map((row, y) =>
    [...row].map((c, x): RowCell => {
      if (c === '.') return EMPTY
      if (c === '-') return KEEP
      const index: PaletteIndex = DIGITS.indexOf(c.toLowerCase())
      if (index < 0) {
        throw new RowsError(
          `row ${y}, column ${x}: "${c}" is not a row character (use . 1-9 a-g -)`,
        )
      }
      if (index >= paletteSize) {
        throw new RowsError(
          `row ${y}, column ${x}: color ${index + 1} is not in the palette (it has ${paletteSize} colors)`,
        )
      }
      return index
    }),
  )
}
