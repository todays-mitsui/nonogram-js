import { describe, expect, it } from 'vitest'
import { BLANK, CROSSED } from './board'
import { EMPTY } from './solution'
import { availableTools, nextMark, nextSolutionCell, Stroke, type Tool } from './tool'

const paint = (paletteIndex: number): Tool => ({ kind: 'paint', paletteIndex })
const cross: Tool = { kind: 'cross' }
const erase: Tool = { kind: 'erase' }

describe('availableTools', () => {
  it('GLOSSARY §5 の表どおり', () => {
    expect(availableTools(['#000'], 'player')).toEqual([paint(0), cross, erase])
    expect(availableTools(['#000'], 'editor')).toEqual([paint(0), erase])
    expect(availableTools(['#f00', '#00f'], 'player')).toEqual([paint(0), paint(1), cross, erase])
    expect(availableTools(['#f00', '#00f'], 'editor')).toEqual([paint(0), paint(1), erase])
  })
})

describe('nextMark(プレイモード)', () => {
  it('塗りは同じ色ならトグル、違う色・バツなら上書き', () => {
    expect(nextMark(BLANK, 'primary', paint(0))).toBe(0)
    expect(nextMark(0, 'primary', paint(0))).toBe(BLANK)
    expect(nextMark(1, 'primary', paint(0))).toBe(0)
    expect(nextMark(CROSSED, 'primary', paint(0))).toBe(0)
  })

  it('バツはトグル', () => {
    expect(nextMark(BLANK, 'primary', cross)).toBe(CROSSED)
    expect(nextMark(CROSSED, 'primary', cross)).toBe(BLANK)
    expect(nextMark(0, 'primary', cross)).toBe(CROSSED)
  })

  it('消しゴムは未記入にする', () => {
    expect(nextMark(0, 'primary', erase)).toBe(BLANK)
    expect(nextMark(CROSSED, 'primary', erase)).toBe(BLANK)
  })

  it('副操作はツールに関係なくバツを付ける・外す', () => {
    for (const tool of [paint(0), cross, erase]) {
      expect(nextMark(BLANK, 'secondary', tool)).toBe(CROSSED)
      expect(nextMark(0, 'secondary', tool)).toBe(CROSSED)
      expect(nextMark(CROSSED, 'secondary', tool)).toBe(BLANK)
    }
  })
})

describe('nextSolutionCell(作問モード)', () => {
  it('塗りは同じ色なら背景に戻す', () => {
    expect(nextSolutionCell(EMPTY, 'primary', paint(1))).toBe(1)
    expect(nextSolutionCell(1, 'primary', paint(1))).toBe(EMPTY)
    expect(nextSolutionCell(0, 'primary', paint(1))).toBe(1)
  })

  it('消しゴムと副操作は背景にする', () => {
    expect(nextSolutionCell(1, 'primary', erase)).toBe(EMPTY)
    expect(nextSolutionCell(1, 'secondary', paint(1))).toBe(EMPTY)
  })

  it('バツツールはない', () => {
    expect(() => nextSolutionCell(EMPTY, 'primary', cross)).toThrow(RangeError)
  })
})

describe('Stroke', () => {
  const bounds = { width: 10, height: 10 }

  it('最初のマスを通ったことにする', () => {
    const stroke = new Stroke({ x: 2, y: 3 }, { bounds, lockAxis: false })
    expect(stroke.visited()).toEqual([{ x: 2, y: 3 }])
    expect(stroke.moveTo({ x: 2, y: 3 })).toEqual([])
  })

  it('飛ばされたマスを補う', () => {
    const stroke = new Stroke({ x: 0, y: 0 }, { bounds, lockAxis: false })
    expect(stroke.moveTo({ x: 3, y: 0 })).toEqual([
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ])
  })

  it('同じマスは2回返さない', () => {
    const stroke = new Stroke({ x: 0, y: 0 }, { bounds, lockAxis: false })
    stroke.moveTo({ x: 2, y: 0 })
    expect(stroke.moveTo({ x: 0, y: 0 })).toEqual([])
  })

  it('作問モードは自由になぞれる', () => {
    const stroke = new Stroke({ x: 0, y: 0 }, { bounds, lockAxis: false })
    stroke.moveTo({ x: 1, y: 0 })
    expect(stroke.moveTo({ x: 1, y: 1 })).toEqual([{ x: 1, y: 1 }])
    expect(stroke.axis).toBeNull()
  })

  it('プレイモードは最初に動いた向きに固定する', () => {
    const row = new Stroke({ x: 2, y: 2 }, { bounds, lockAxis: true })
    expect(row.moveTo({ x: 3, y: 2 })).toEqual([{ x: 3, y: 2 }])
    expect(row.axis).toBe('row')
    // 斜めにずれても行の上に射影する
    expect(row.moveTo({ x: 4, y: 5 })).toEqual([{ x: 4, y: 2 }])

    const column = new Stroke({ x: 2, y: 2 }, { bounds, lockAxis: true })
    column.moveTo({ x: 3, y: 5 })
    expect(column.axis).toBe('column')
    expect(column.visited()).toEqual([
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 2, y: 4 },
      { x: 2, y: 5 },
    ])
  })

  it('範囲の外に出たら端のマスに寄せる', () => {
    const stroke = new Stroke({ x: 8, y: 0 }, { bounds, lockAxis: true })
    expect(stroke.moveTo({ x: 15, y: 0 })).toEqual([{ x: 9, y: 0 }])
    expect(stroke.moveTo({ x: -3, y: 0 }).at(-1)).toEqual({ x: 0, y: 0 })
  })
})
