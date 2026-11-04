import { describe, expect, it } from 'vitest'
import { Grid } from './grid'
import {
  createSolution,
  crop,
  EMPTY,
  emptySolution,
  extentOf,
  hasCellsOutsideFrame,
  resizeFrame,
  trimToExtent,
  visibleGrid,
  type SolutionCell,
} from './solution'

const _ = EMPTY

// 3x2 の可視領域、右に枠外のマスがある 5x3 の grid(下の行は背景だけ)
const grid = Grid.fromRows<SolutionCell>([
  [0, _, 0, _, 1],
  [_, 0, _, _, _],
  [_, _, _, _, _],
])
const solution = createSolution(grid, { width: 3, height: 2 })

describe('Solution', () => {
  it('frame は 1x1 以上で grid を超えない', () => {
    expect(() => createSolution(grid, { width: 0, height: 1 })).toThrow(RangeError)
    expect(() => createSolution(grid, { width: 6, height: 1 })).toThrow(RangeError)
    expect(emptySolution(2, 2).frame).toEqual({ width: 2, height: 2 })
  })

  it('データ領域は可視領域と背景以外のマスを含む最小の長方形', () => {
    expect(extentOf(solution)).toEqual({ width: 5, height: 2 })
    expect(extentOf(emptySolution(4, 3))).toEqual({ width: 4, height: 3 })
    expect(trimToExtent(solution).grid.size).toEqual({ width: 5, height: 2 })
  })

  it('crop は枠外のマスを捨てる', () => {
    const cropped = crop(solution)
    expect(cropped.grid.rows()).toEqual([
      [0, _, 0],
      [_, 0, _],
    ])
    expect(hasCellsOutsideFrame(solution)).toBe(true)
    expect(hasCellsOutsideFrame(cropped)).toBe(false)
    expect(visibleGrid(solution).equals(cropped.grid)).toBe(true)
  })

  it('サイズを縮めても枠外のマスは残り、戻せば再び見える', () => {
    const shrunk = resizeFrame(solution, { width: 1, height: 1 })
    expect(shrunk.frame).toEqual({ width: 1, height: 1 })
    expect(shrunk.grid.get(4, 0)).toBe(1)
    const restored = resizeFrame(shrunk, { width: 5, height: 2 })
    expect(visibleGrid(restored).rows()).toEqual([
      [0, _, 0, _, 1],
      [_, 0, _, _, _],
    ])
  })

  it('サイズを広げると背景で埋める', () => {
    const grown = resizeFrame(solution, { width: 6, height: 4 })
    expect(grown.grid.size).toEqual({ width: 6, height: 4 })
    expect(grown.grid.get(5, 3)).toBe(_)
  })
})
