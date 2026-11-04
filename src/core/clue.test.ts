import { describe, expect, it } from 'vitest'
import { BLANK, CROSSED, emptyBoard, type Mark } from './board'
import { deriveClue, derivePuzzle, isSolved, satisfaction } from './clue'
import { Grid } from './grid'
import { createSolution, EMPTY, type SolutionCell } from './solution'

const _ = EMPTY
const color = (c: SolutionCell) => (c === _ ? null : c)
const entry = (length: number, paletteIndex = 0) => ({ length, paletteIndex })

describe('deriveClue', () => {
  it('モノクロ', () => {
    expect(deriveClue([0, 0, _, 0, _, _, 0, 0, 0], color)).toEqual([entry(2), entry(1), entry(3)])
  })

  it('空ラインは []', () => {
    expect(deriveClue([_, _, _], color)).toEqual([])
  })

  it('違う色のブロックは隙間なしで隣接してよい', () => {
    expect(deriveClue([0, 0, 1, 1, 1, _, 1], color)).toEqual([
      entry(2, 0),
      entry(3, 1),
      entry(1, 1),
    ])
  })
})

// 4x3 の可視領域、右の2列が枠外
const solution = createSolution(
  Grid.fromRows<SolutionCell>([
    [0, 0, 1, _, _, 1],
    [0, _, 1, _, _, _],
    [0, 0, 1, _, 1, 1],
  ]),
  { width: 4, height: 3 },
)
const puzzle = derivePuzzle(solution, ['#F33', '#3366cc'])

describe('derivePuzzle', () => {
  it('可視領域の中だけからヒントを導出する', () => {
    expect(puzzle.size).toEqual({ width: 4, height: 3 })
    expect(puzzle.rowClues).toEqual([
      [entry(2, 0), entry(1, 1)],
      [entry(1, 0), entry(1, 1)],
      [entry(2, 0), entry(1, 1)],
    ])
    expect(puzzle.columnClues).toEqual([
      [entry(3, 0)],
      [entry(1, 0), entry(1, 0)],
      [entry(3, 1)],
      [],
    ])
  })
})

describe('satisfaction / isSolved', () => {
  const answer = Grid.fromRows<Mark>([
    [0, 0, 1, CROSSED],
    [0, BLANK, 1, BLANK],
    [0, 0, 1, CROSSED],
  ])

  it('未記入の盤面は空ラインだけが一致する', () => {
    const s = satisfaction(emptyBoard(4, 3), puzzle)
    expect(s.rows).toEqual([false, false, false])
    expect(s.columns).toEqual([false, false, false, true])
  })

  it('バツと未記入はどちらも背景として扱う', () => {
    expect(isSolved(answer, puzzle)).toBe(true)
  })

  it('色が違えば一致しない', () => {
    const wrong = answer.set(2, 0, 0)
    const s = satisfaction(wrong, puzzle)
    expect(s.rows[0]).toBe(false)
    expect(s.columns[2]).toBe(false)
    expect(isSolved(wrong, puzzle)).toBe(false)
  })

  it('正解図と違っても、ヒントが全部一致すれば解けた(別解)', () => {
    // 2x2 の対角線は別解がある
    const diagonal = derivePuzzle(
      createSolution(
        Grid.fromRows<SolutionCell>([
          [0, _],
          [_, 0],
        ]),
      ),
      ['#000'],
    )
    const other = Grid.fromRows<Mark>([
      [BLANK, 0],
      [0, BLANK],
    ])
    expect(isSolved(other, diagonal)).toBe(true)
  })

  it('サイズが違えば RangeError', () => {
    expect(() => satisfaction(emptyBoard(3, 3), puzzle)).toThrow(RangeError)
  })
})
