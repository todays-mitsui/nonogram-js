/**
 * 盤面(GLOSSARY §4)。解答者が記入中の状態。常に可視領域 = データ領域。
 */

import { Grid } from './grid'
import type { PaletteIndex } from './palette'

export const BLANK = 'blank'
export const CROSSED = 'crossed'

/** 盤面の1マス。未記入・バツ・塗り(PaletteIndex)のいずれか。 */
export type Mark = typeof BLANK | typeof CROSSED | PaletteIndex

export type Board = Grid<Mark>

export function emptyBoard(width: number, height: number): Board {
  return Grid.filled<Mark>(width, height, BLANK)
}

export function isFilled(mark: Mark): mark is PaletteIndex {
  return typeof mark === 'number'
}
