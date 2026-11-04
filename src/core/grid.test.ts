import { describe, expect, it } from 'vitest'
import { Grid } from './grid'

const sample = () =>
  Grid.fromRows([
    [1, 2, 3],
    [4, 5, 6],
  ])

describe('Grid', () => {
  it('作り方', () => {
    expect(Grid.filled(2, 3, 0).toCells()).toEqual([0, 0, 0, 0, 0, 0])
    expect(sample().size).toEqual({ width: 3, height: 2 })
    expect(() => Grid.fromCells(2, 2, [1, 2, 3])).toThrow(RangeError)
    expect(() => Grid.fromRows([[1, 2], [3]])).toThrow(RangeError)
    expect(() => Grid.filled(-1, 1, 0)).toThrow(RangeError)
  })

  it('座標は左上原点で x が列、y が行', () => {
    const g = sample()
    expect(g.get(0, 0)).toBe(1)
    expect(g.get(2, 0)).toBe(3)
    expect(g.get(0, 1)).toBe(4)
    expect(() => g.get(3, 0)).toThrow(RangeError)
    expect(() => g.get(0, -1)).toThrow(RangeError)
    expect(g.contains(2, 1)).toBe(true)
    expect(g.contains(0.5, 0)).toBe(false)
  })

  it('set は新しいグリッドを返し、元は変えない', () => {
    const g = sample()
    const h = g.set(1, 1, 9)
    expect(h.get(1, 1)).toBe(9)
    expect(g.get(1, 1)).toBe(5)
    expect(g.set(1, 1, 5)).toBe(g)
  })

  it('setMany は後の更新が勝つ', () => {
    const h = sample().setMany([
      { x: 0, y: 0, value: 7 },
      { x: 0, y: 0, value: 8 },
    ])
    expect(h.get(0, 0)).toBe(8)
  })

  it('ラインの取り出し', () => {
    const g = sample()
    expect(g.line({ axis: 'row', index: 1 })).toEqual([4, 5, 6])
    expect(g.line({ axis: 'column', index: 2 })).toEqual([3, 6])
    expect(g.rows()).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ])
    expect(g.columns()).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ])
    expect(() => g.line({ axis: 'row', index: 2 })).toThrow(RangeError)
  })

  it('resize は左上を固定し、広げた部分を埋め、はみ出しを捨てる', () => {
    const g = sample()
    expect(g.resize(4, 3, 0).rows()).toEqual([
      [1, 2, 3, 0],
      [4, 5, 6, 0],
      [0, 0, 0, 0],
    ])
    expect(g.resize(2, 1, 0).rows()).toEqual([[1, 2]])
  })

  it('map と equals', () => {
    const g = sample()
    expect(g.map((v, x, y) => v * 10 + x + y).rows()).toEqual([
      [10, 21, 32],
      [41, 52, 63],
    ])
    expect(g.equals(sample())).toBe(true)
    expect(g.equals(g.set(0, 0, 0))).toBe(false)
    expect(g.equals(g.resize(3, 3, 0))).toBe(false)
  })
})
