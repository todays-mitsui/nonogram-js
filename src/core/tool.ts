/**
 * ツール・記号遷移・ストローク(GLOSSARY §5)。
 */

import { BLANK, CROSSED, type Mark } from './board'
import type { Axis, Point, Size } from './grid'
import type { Palette, PaletteIndex } from './palette'
import { EMPTY, type SolutionCell } from './solution'

export type Tool =
  | { readonly kind: 'paint'; readonly paletteIndex: PaletteIndex }
  | { readonly kind: 'cross' }
  | { readonly kind: 'erase' }

/** 主操作 = タップ / 左クリック。副操作 = 右クリック、または修飾キー + クリック。 */
export type Operation = 'primary' | 'secondary'

export type Mode = 'player' | 'editor'

/** パズルの種類とモードで決まるツールの候補(GLOSSARY §5 の表)。 */
export function availableTools(palette: Palette, mode: Mode): Tool[] {
  const paints = palette.map((_, paletteIndex): Tool => ({ kind: 'paint', paletteIndex }))
  return mode === 'player'
    ? [...paints, { kind: 'cross' }, { kind: 'erase' }]
    : [...paints, { kind: 'erase' }]
}

/** 開いた時点の現在のツール。塗り(色0)。 */
export const INITIAL_TOOL: Tool = { kind: 'paint', paletteIndex: 0 }

/**
 * プレイモードの記号遷移。
 * - 副操作: ツールに関係なくバツを付ける・外す
 * - 塗り: 同じ色で塗られたマスなら未記入に戻す(トグル)
 * - バツ: バツなら未記入に戻す(トグル。副操作と揃える)
 * - 消しゴム: 未記入にする
 */
export function nextMark(current: Mark, operation: Operation, tool: Tool): Mark {
  if (operation === 'secondary') return current === CROSSED ? BLANK : CROSSED
  switch (tool.kind) {
    case 'paint':
      return current === tool.paletteIndex ? BLANK : tool.paletteIndex
    case 'cross':
      return current === CROSSED ? BLANK : CROSSED
    case 'erase':
      return BLANK
  }
}

/**
 * 作問モードの記号遷移。作問モードにバツはない。
 * - 副操作: 背景にする(消しゴムと同じ)
 * - 塗り: 同じ色で塗られたマスなら背景に戻す(トグル)
 */
export function nextSolutionCell(
  current: SolutionCell,
  operation: Operation,
  tool: Tool,
): SolutionCell {
  if (operation === 'secondary') return EMPTY
  switch (tool.kind) {
    case 'paint':
      return current === tool.paletteIndex ? EMPTY : tool.paletteIndex
    case 'erase':
      return EMPTY
    case 'cross':
      throw new RangeError('the cross tool is not available in the editor')
  }
}

export interface StrokeOptions {
  /** マスの範囲。外に出たポインタは端のマスに寄せる。 */
  readonly bounds: Size
  /**
   * 最初に動いた向き(行か列)にストロークを固定するか。プレイモードは true、作問モードは false。
   */
  readonly lockAxis: boolean
}

/**
 * ポインタを押してから離すまでの一連の操作。どのマスを通ったかだけを扱う。
 * 適用する記号は呼び出し側が最初のマスで決め(nextMark / nextSolutionCell)、通ったマスすべてに同じく適用する。
 * ポインタイベントの間に飛ばされたマスも、間を補って通ったことにする。
 */
export class Stroke {
  readonly start: Point
  readonly #options: StrokeOptions
  #axis: Axis | null = null
  #last: Point
  readonly #visited = new Set<string>()

  constructor(start: Point, options: StrokeOptions) {
    this.#options = options
    this.start = this.#clamp(start)
    this.#last = this.start
    this.#visited.add(key(this.start))
  }

  /** 固定された向き。まだ最初のマスから動いていないか、固定しないなら null。 */
  get axis(): Axis | null {
    return this.#axis
  }

  /** ポインタが `point` のマスに来た。新しく通ったマスを、通った順に返す。 */
  moveTo(point: Point): Point[] {
    let target = this.#clamp(point)
    if (this.#options.lockAxis) {
      if (this.#axis === null && !samePoint(target, this.start)) {
        const dx = Math.abs(target.x - this.start.x)
        const dy = Math.abs(target.y - this.start.y)
        this.#axis = dx >= dy ? 'row' : 'column'
      }
      if (this.#axis === 'row') target = { x: target.x, y: this.start.y }
      if (this.#axis === 'column') target = { x: this.start.x, y: target.y }
    }
    const added: Point[] = []
    for (const p of lineBetween(this.#last, target)) {
      const k = key(p)
      if (!this.#visited.has(k)) {
        this.#visited.add(k)
        added.push(p)
      }
    }
    this.#last = target
    return added
  }

  /** これまでに通ったマス(最初のマスを含む)。 */
  visited(): Point[] {
    return [...this.#visited].map((k) => {
      const [x, y] = k.split(',').map(Number) as [number, number]
      return { x, y }
    })
  }

  #clamp({ x, y }: Point): Point {
    const { width, height } = this.#options.bounds
    return {
      x: Math.min(Math.max(Math.floor(x), 0), width - 1),
      y: Math.min(Math.max(Math.floor(y), 0), height - 1),
    }
  }
}

/** a から b までのマス(Bresenham)。a を含み、b を含む。 */
function lineBetween(a: Point, b: Point): Point[] {
  const points: Point[] = []
  const dx = Math.abs(b.x - a.x)
  const dy = -Math.abs(b.y - a.y)
  const sx = a.x < b.x ? 1 : -1
  const sy = a.y < b.y ? 1 : -1
  let err = dx + dy
  let { x, y } = a
  for (;;) {
    points.push({ x, y })
    if (x === b.x && y === b.y) return points
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
}

const key = (p: Point) => `${p.x},${p.y}`
const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y
