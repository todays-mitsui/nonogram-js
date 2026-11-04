/**
 * 正解図(GLOSSARY §2)。グリッドはデータ領域全体を持ち、可視領域(frame)は別に持つ。
 */

import { Grid, type Size } from './grid'
import type { PaletteIndex } from './palette'

/** 正解図の背景。 */
export const EMPTY = 'empty'
export type Empty = typeof EMPTY

/** 正解図の1マス。背景か、その色で塗るか。 */
export type SolutionCell = Empty | PaletteIndex

export interface Solution {
  /** データ領域全体。左上は (0, 0) 固定。 */
  readonly grid: Grid<SolutionCell>
  /** 可視領域のサイズ。幅・高さとも grid 以下。 */
  readonly frame: Size
}

/** 全マス背景の正解図。可視領域 = データ領域。 */
export function emptySolution(width: number, height: number): Solution {
  return { grid: Grid.filled<SolutionCell>(width, height, EMPTY), frame: { width, height } }
}

export function createSolution(grid: Grid<SolutionCell>, frame: Size = grid.size): Solution {
  if (frame.width < 1 || frame.height < 1) {
    throw new RangeError(`frame must be at least 1x1, got ${frame.width}x${frame.height}`)
  }
  if (frame.width > grid.width || frame.height > grid.height) {
    throw new RangeError(
      `frame ${frame.width}x${frame.height} exceeds the ${grid.width}x${grid.height} grid`,
    )
  }
  return { grid, frame }
}

/**
 * データ領域(Extent): 可視領域と、背景以外のマスをすべて含む最小の長方形。
 * grid が最小でない(右や下に背景だけの列・行がある)こともあるので、マスを見て求める。
 */
export function extentOf(solution: Solution): Size {
  let width = solution.frame.width
  let height = solution.frame.height
  const { grid } = solution
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (grid.get(x, y) !== EMPTY) {
        width = Math.max(width, x + 1)
        height = Math.max(height, y + 1)
      }
    }
  }
  return { width, height }
}

/** grid をデータ領域に切り詰める。正解図コードにする前に使う。 */
export function trimToExtent(solution: Solution): Solution {
  const { width, height } = extentOf(solution)
  return { grid: solution.grid.resize(width, height, EMPTY), frame: solution.frame }
}

/** 切り抜き: データ領域を可視領域に切り詰め、枠外のマスを捨てる。 */
export function crop(solution: Solution): Solution {
  const { width, height } = solution.frame
  return { grid: solution.grid.resize(width, height, EMPTY), frame: solution.frame }
}

/** 枠外のマス(可視領域の外にある背景以外のマス)があるか。 */
export function hasCellsOutsideFrame(solution: Solution): boolean {
  const extent = extentOf(solution)
  return extent.width > solution.frame.width || extent.height > solution.frame.height
}

/**
 * サイズ(可視領域)を変える。枠外のマスは捨てずに保持する。
 * 広げた結果 grid より大きくなる部分は背景で埋める。
 */
export function resizeFrame(solution: Solution, frame: Size): Solution {
  const grid = solution.grid.resize(
    Math.max(solution.grid.width, frame.width),
    Math.max(solution.grid.height, frame.height),
    EMPTY,
  )
  return trimToExtent(createSolution(grid, frame))
}

/** 可視領域の中のマス。プレイモードはここだけを使う。 */
export function visibleGrid(solution: Solution): Grid<SolutionCell> {
  return crop(solution).grid
}
