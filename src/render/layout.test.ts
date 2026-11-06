import { describe, expect, it } from 'vitest'
import { derivePuzzle } from '../core/clue'
import { Grid } from '../core/grid'
import { createSolution, EMPTY, type SolutionCell } from '../core/solution'
import { cellAt, clueEntryAt, computeLayout, MAX_CELL_SIZE, MIN_CELL_SIZE } from './layout'

const _ = EMPTY
// 行ヒントは最大2項目、列ヒントは最大1項目
const puzzle = derivePuzzle(
  createSolution(
    Grid.fromRows<SolutionCell>([
      [0, _, 0, _],
      [0, 0, 0, 0],
      [_, _, _, _],
    ]),
  ),
  ['#000'],
)

describe('computeLayout', () => {
  it('ヒント項目1つにマス1つ分を割り当て、収まる最大の cellSize を選ぶ', () => {
    // 列: 2 + 4 = 6、行: 2 + 3 = 5
    const layout = computeLayout(puzzle, { width: 180, height: 300 })
    expect(layout.rowClueSlots).toBe(2)
    expect(layout.columnClueSlots).toBe(1)
    expect(layout.cellSize).toBe(30)
    expect(layout.cellAreaX).toBe(60)
    expect(layout.cellAreaY).toBe(30)
    expect(layout.puzzleAreaWidth).toBe(180)
    expect(layout.puzzleAreaHeight).toBe(120)
    expect(layout.overflows).toBe(false)
  })

  it('上限は 40px', () => {
    expect(computeLayout(puzzle, { width: 2000, height: 2000 }).cellSize).toBe(MAX_CELL_SIZE)
  })

  it('下限は 16px で、収まらなければスクロールが要る', () => {
    const layout = computeLayout(puzzle, { width: 60, height: 60 })
    expect(layout.cellSize).toBe(MIN_CELL_SIZE)
    expect(layout.overflows).toBe(true)
  })
})

describe('cellAt', () => {
  const layout = computeLayout(puzzle, { width: 180, height: 300 })

  it('マス領域の中', () => {
    expect(cellAt(layout, puzzle, 60, 30)).toEqual({ x: 0, y: 0 })
    expect(cellAt(layout, puzzle, 179, 119)).toEqual({ x: 3, y: 2 })
  })

  it('ヒント領域や外は null', () => {
    expect(cellAt(layout, puzzle, 59, 40)).toBeNull()
    expect(cellAt(layout, puzzle, 70, 29)).toBeNull()
    expect(cellAt(layout, puzzle, 180, 40)).toBeNull()
  })
})

describe('clueEntryAt', () => {
  const colored = derivePuzzle(
    createSolution(
      Grid.fromRows<SolutionCell>([
        [0, 1, _],
        [_, _, _],
        [1, 1, 0],
      ]),
    ),
    ['#000', '#f00'],
  )
  // 行ヒント最大2項目・列ヒント最大2項目、cellSize 20 → マス領域は (40, 40) から
  const layout = computeLayout(colored, { width: 100, height: 100 })

  it('行ヒントは右寄せで並ぶ', () => {
    expect(layout.cellSize).toBe(20)
    // 1行目は [黒1, 赤1]
    expect(clueEntryAt(layout, colored, 10, 50)).toEqual({ length: 1, paletteIndex: 0 })
    expect(clueEntryAt(layout, colored, 30, 50)).toEqual({ length: 1, paletteIndex: 1 })
    // 3行目は [赤2, 黒1]
    expect(clueEntryAt(layout, colored, 30, 90)).toEqual({ length: 1, paletteIndex: 0 })
  })

  it('列ヒントは下寄せで並ぶ', () => {
    // 2列目は [赤1, 赤1]、3列目は [黒1] だけ
    expect(clueEntryAt(layout, colored, 70, 10)).toEqual({ length: 1, paletteIndex: 1 })
    expect(clueEntryAt(layout, colored, 90, 30)).toEqual({ length: 1, paletteIndex: 0 })
    expect(clueEntryAt(layout, colored, 90, 10)).toBeNull()
  })

  it('空ライン・マス領域・左上の角は null', () => {
    expect(clueEntryAt(layout, colored, 30, 70)).toBeNull()
    expect(clueEntryAt(layout, colored, 50, 50)).toBeNull()
    expect(clueEntryAt(layout, colored, 10, 10)).toBeNull()
  })
})
