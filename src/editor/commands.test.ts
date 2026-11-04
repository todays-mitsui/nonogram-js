import { describe, expect, it } from 'vitest'
import { Grid } from '../core/grid'
import { createSolution, EMPTY, visibleGrid, type SolutionCell } from '../core/solution'
import {
  addColor,
  clear,
  countCells,
  EditorCommandError,
  moveColor,
  newDoc,
  paintCells,
  removeColor,
  setSize,
  updateColor,
  type EditorDoc,
} from './commands'
import { EditorHistory } from './history'

const _ = EMPTY
const doc3 = (): EditorDoc => ({
  palette: ['#f00', '#0f0', '#00f'],
  solution: createSolution(
    Grid.fromRows<SolutionCell>([
      [0, 1, 2, _, _],
      [2, 1, 0, _, _],
      [_, _, _, _, _],
      [_, _, _, _, _],
      [_, _, _, _, _],
    ]),
  ),
})

describe('commands', () => {
  it('新規作成は 15x15・黒1色', () => {
    const doc = newDoc()
    expect(doc.solution.frame).toEqual({ width: 15, height: 15 })
    expect(doc.palette).toEqual(['#000'])
  })

  it('サイズは 5〜100 の整数。縮めても枠外のマスは残る', () => {
    expect(() => setSize(newDoc(), 4, 10)).toThrow(EditorCommandError)
    expect(() => setSize(newDoc(), 10, 101)).toThrow(EditorCommandError)
    expect(() => setSize(newDoc(), 10.5, 10)).toThrow(EditorCommandError)
    const painted = paintCells(newDoc(), [{ x: 14, y: 14 }], 0)
    const shrunk = setSize(painted, 5, 5)
    expect(shrunk.solution.grid.get(14, 14)).toBe(0)
    expect(setSize(shrunk, 15, 15).solution.grid.get(14, 14)).toBe(0)
  })

  it('色は 16 色まで、#RGB / #RRGGBB だけ', () => {
    let doc = newDoc()
    for (let i = 1; i < 16; i++) doc = addColor(doc, '#123')
    expect(doc.palette).toHaveLength(16)
    expect(() => addColor(doc, '#123')).toThrow(EditorCommandError)
    expect(() => addColor(newDoc(), 'red')).toThrow(EditorCommandError)
    expect(updateColor(newDoc(), 0, '#ff0000').palette).toEqual(['#ff0000'])
    expect(() => updateColor(newDoc(), 1, '#fff')).toThrow(EditorCommandError)
  })

  it('色を削除すると、その色のマスは背景になり、後ろの色が詰まる', () => {
    const doc = removeColor(doc3(), 1)
    expect(doc.palette).toEqual(['#f00', '#00f'])
    expect(visibleGrid(doc.solution).rows().slice(0, 2)).toEqual([
      [0, _, 1, _, _],
      [1, _, 0, _, _],
    ])
    expect(() => removeColor(newDoc(), 0)).toThrow(EditorCommandError)
  })

  it('色を並べ替えると PaletteIndex を振り直す', () => {
    const doc = moveColor(doc3(), 0, 2)
    expect(doc.palette).toEqual(['#0f0', '#00f', '#f00'])
    expect(visibleGrid(doc.solution).rows()[0]?.slice(0, 3)).toEqual([2, 0, 1])
    expect(moveColor(doc3(), 1, 1)).toEqual(doc3())
  })

  it('塗りは可視領域の中だけ。パレットにない色はエラー', () => {
    expect(() => paintCells(newDoc(), [{ x: 15, y: 0 }], 0)).toThrow(EditorCommandError)
    expect(() => paintCells(newDoc(), [{ x: 0, y: 0 }], 1)).toThrow(EditorCommandError)
    const doc = newDoc()
    expect(paintCells(doc, [{ x: 0, y: 0 }], EMPTY)).toBe(doc)
  })

  it('clear は枠外も消す', () => {
    const shrunk = setSize(paintCells(newDoc(), [{ x: 14, y: 14 }], 0), 5, 5)
    const cleared = clear(shrunk)
    expect(cleared.solution.grid.size).toEqual({ width: 5, height: 5 })
  })

  it('countCells', () => {
    expect(countCells(doc3(), 0)).toBe(2)
  })
})

describe('EditorHistory', () => {
  it('コマンド1回がアンドゥ1回分。投げたコマンドは状態を変えない', () => {
    const history = new EditorHistory(newDoc())
    history.apply((d) => setSize(d, 10, 10))
    expect(() => history.apply((d) => setSize(d, 1, 1))).toThrow(EditorCommandError)
    expect(history.doc.solution.frame.width).toBe(10)
    history.undo()
    expect(history.doc.solution.frame.width).toBe(15)
    history.redo()
    expect(history.doc.solution.frame.width).toBe(10)
  })

  it('ストローク1回がアンドゥ1回分。方向は固定せず、同じ色はトグル', () => {
    const history = new EditorHistory(newDoc())
    history.beginStroke({ x: 0, y: 0 }, 'primary', { kind: 'paint', paletteIndex: 0 })
    history.strokeTo({ x: 1, y: 1 })
    history.strokeTo({ x: 1, y: 2 })
    history.endStroke()
    expect(history.doc.solution.grid.get(1, 2)).toBe(0)
    history.beginStroke({ x: 0, y: 0 }, 'primary', { kind: 'paint', paletteIndex: 0 })
    history.endStroke()
    expect(history.doc.solution.grid.get(0, 0)).toBe(EMPTY)
    history.undo()
    history.undo()
    expect(history.doc.solution.grid.get(1, 2)).toBe(EMPTY)
    expect(history.canUndo).toBe(false)
  })
})
