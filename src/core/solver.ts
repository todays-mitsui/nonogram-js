/**
 * ソルバー(README §5.1 一意解チェック)。ヒントだけから解く。カラー問題にも対応する。
 *
 * 各マスの「入りうる値」をビットの集合で持つ。ビット 0 が背景、ビット i + 1 が PaletteIndex i。
 *
 * 1. ラインソルバー: 1ラインごとに、ヒントと今の候補に合う置き方をすべて考え、
 *    どの置き方でも入りえない値を候補から外す。全ラインで変化がなくなるまで繰り返す
 * 2. バックトラック: ラインソルバーで止まったら、候補が残るマスに値を仮置きして続ける。解を2つまで探す
 */

import type { Clue, Puzzle } from './clue'
import { Grid } from './grid'
import { EMPTY, type SolutionCell } from './solution'

const BG = 1
const colorBit = (paletteIndex: number) => 1 << (paletteIndex + 1)

export type UniquenessResult =
  /** ライン推論だけで全マスが決まる。 */
  | { readonly kind: 'line-solvable' }
  /** ライン推論では止まるが、解は1つだけ。 */
  | { readonly kind: 'needs-guessing' }
  /** 解が2つ以上ある。`solutions` は見つかった2つ。 */
  | {
      readonly kind: 'multiple'
      readonly solutions: readonly [Grid<SolutionCell>, Grid<SolutionCell>]
    }
  /** 時間内に判定が終わらなかった。 */
  | { readonly kind: 'timed-out' }

export interface SolveOptions {
  /** 判定にかけてよい時間(ミリ秒)。 */
  readonly timeLimitMs?: number
  /** 中断。true を返したら打ち切って timed-out にする。 */
  readonly shouldStop?: () => boolean
  readonly now?: () => number
}

/**
 * 1ライン分の推論。`cells` は各マスの候補(ビット集合)。
 * どの置き方でも入りえない値を外した候補を返す。矛盾していれば null。
 */
export function solveLine(clue: Clue, cells: readonly number[]): number[] | null {
  const n = cells.length
  const k = clue.length

  // 「範囲のマスがすべて背景になりうるか」「すべてその色になりうるか」を O(1) で調べるための累積和
  const prefix = (bit: number) => {
    const p = new Int32Array(n + 1)
    for (let i = 0; i < n; i++) p[i + 1] = (p[i] as number) + ((cells[i] as number) & bit ? 0 : 1)
    return p
  }
  const bgBlocked = prefix(BG)
  const colorBlocked = new Map<number, Int32Array>()
  for (const e of clue) {
    if (!colorBlocked.has(e.paletteIndex))
      colorBlocked.set(e.paletteIndex, prefix(colorBit(e.paletteIndex)))
  }
  const bgRange = (a: number, b: number) =>
    a >= 0 && b <= n && a <= b && bgBlocked[b] === bgBlocked[a]
  const colorRange = (a: number, b: number, color: number) => {
    const p = colorBlocked.get(color) as Int32Array
    return a >= 0 && b <= n && p[b] === p[a]
  }
  // ブロック j とその前のブロックの間に要る背景のマス数
  const gapBefore = (j: number) =>
    j > 0 && clue[j - 1]?.paletteIndex === clue[j]?.paletteIndex ? 1 : 0

  // fwd[j][i]: 最初の j 個のブロックを [0, i) に置け、残りのマスは背景
  const fwd = Array.from({ length: k + 1 }, () => new Uint8Array(n + 1))
  // bwd[j][i]: ブロック j 以降を [i, n) に置け、残りのマスは背景
  const bwd = Array.from({ length: k + 2 }, () => new Uint8Array(n + 2))

  for (let i = 0; i <= n; i++) fwd[0]![i] = bgRange(0, i) ? 1 : 0
  for (let j = 0; j < k; j++) {
    const { length, paletteIndex } = clue[j]!
    const gap = gapBefore(j)
    const row = fwd[j + 1]!
    for (let e = length; e <= n; e++) {
      const s = e - length
      const ends =
        colorRange(s, e, paletteIndex) &&
        s - gap >= 0 &&
        fwd[j]![s - gap] === 1 &&
        bgRange(s - gap, s)
      row[e] = ends || (e > 0 && row[e - 1] === 1 && bgRange(e - 1, e)) ? 1 : 0
    }
  }
  if (fwd[k]![n] !== 1) return null

  for (let i = n; i >= 0; i--) bwd[k]![i] = bgRange(i, n) ? 1 : 0
  for (let j = k - 1; j >= 0; j--) {
    const { length, paletteIndex } = clue[j]!
    const gap = gapBefore(j + 1)
    const row = bwd[j]!
    for (let s = n - length; s >= 0; s--) {
      const e = s + length
      const starts =
        colorRange(s, e, paletteIndex) &&
        e + gap <= n &&
        bwd[j + 1]![e + gap] === 1 &&
        bgRange(e, e + gap)
      row[s] = starts || (row[s + 1] === 1 && bgRange(s, s + 1)) ? 1 : 0
    }
  }

  // 置ける位置ごとに、覆うマスへその色を足す(差分配列で区間をまとめて塗る)
  const possible = new Array<number>(n).fill(0)
  const diffs = new Map<number, Int32Array>()
  for (let j = 0; j < k; j++) {
    const { length, paletteIndex } = clue[j]!
    const before = gapBefore(j)
    const after = gapBefore(j + 1)
    let diff = diffs.get(paletteIndex)
    if (!diff) diffs.set(paletteIndex, (diff = new Int32Array(n + 1)))
    for (let s = 0; s + length <= n; s++) {
      const e = s + length
      if (!colorRange(s, e, paletteIndex)) continue
      const prefixOk =
        j === 0
          ? bgRange(0, s)
          : s - before >= 0 && fwd[j]![s - before] === 1 && bgRange(s - before, s)
      if (!prefixOk) continue
      const suffixOk =
        j === k - 1
          ? bgRange(e, n)
          : e + after <= n && bgRange(e, e + after) && bwd[j + 1]![e + after] === 1
      if (!suffixOk) continue
      diff[s]!++
      diff[e]!--
    }
  }
  for (const [color, diff] of diffs) {
    let run = 0
    const bit = colorBit(color)
    for (let i = 0; i < n; i++) {
      run += diff[i] as number
      if (run > 0) possible[i]! |= bit
    }
  }
  // マス c が背景になる置き方: c より前に j 個、c より後に残りを置ける
  for (let c = 0; c < n; c++) {
    if (!((cells[c] as number) & BG)) continue
    for (let j = 0; j <= k; j++) {
      if (fwd[j]![c] === 1 && bwd[j]![c + 1] === 1) {
        possible[c]! |= BG
        break
      }
    }
  }

  const result = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const v = (cells[i] as number) & (possible[i] as number)
    if (v === 0) return null
    result[i] = v
  }
  return result
}

/** 盤面全体の候補。 */
class Candidates {
  constructor(
    readonly width: number,
    readonly height: number,
    readonly cells: Int32Array,
  ) {}

  static initial(puzzle: Puzzle): Candidates {
    const { width, height } = puzzle.size
    const colorsOf = (clue: Clue) => clue.reduce((bits, e) => bits | colorBit(e.paletteIndex), 0)
    const rowColors = puzzle.rowClues.map(colorsOf)
    const columnColors = puzzle.columnClues.map(colorsOf)
    const cells = new Int32Array(width * height)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        cells[y * width + x] = BG | ((rowColors[y] as number) & (columnColors[x] as number))
      }
    }
    return new Candidates(width, height, cells)
  }

  clone(): Candidates {
    return new Candidates(this.width, this.height, this.cells.slice())
  }

  row(y: number): number[] {
    return Array.from(this.cells.subarray(y * this.width, (y + 1) * this.width))
  }

  column(x: number): number[] {
    return Array.from({ length: this.height }, (_, y) => this.cells[y * this.width + x] as number)
  }

  solved(): boolean {
    return this.cells.every((v) => (v & (v - 1)) === 0)
  }

  toGrid(): Grid<SolutionCell> {
    return Grid.fromCells(
      this.width,
      this.height,
      Array.from(this.cells, (v): SolutionCell => (v === BG ? EMPTY : Math.log2(v) - 1)),
    )
  }
}

/** 変化がなくなるまでラインソルバーを繰り返す。矛盾したら false。 */
function propagate(puzzle: Puzzle, c: Candidates, stop: () => boolean): boolean | 'stopped' {
  const { width, height } = c
  // 0..height-1 が行、height..height+width-1 が列
  const dirty = new Uint8Array(width + height).fill(1)
  const queue: number[] = Array.from({ length: width + height }, (_, i) => i)
  while (queue.length > 0) {
    if (stop()) return 'stopped'
    const line = queue.shift() as number
    dirty[line] = 0
    if (line < height) {
      const y = line
      const next = solveLine(puzzle.rowClues[y] as Clue, c.row(y))
      if (!next) return false
      for (let x = 0; x < width; x++) {
        const i = y * width + x
        if (c.cells[i] !== next[x]) {
          c.cells[i] = next[x] as number
          if (!dirty[height + x]) {
            dirty[height + x] = 1
            queue.push(height + x)
          }
        }
      }
    } else {
      const x = line - height
      const next = solveLine(puzzle.columnClues[x] as Clue, c.column(x))
      if (!next) return false
      for (let y = 0; y < height; y++) {
        const i = y * width + x
        if (c.cells[i] !== next[y]) {
          c.cells[i] = next[y] as number
          if (!dirty[y]) {
            dirty[y] = 1
            queue.push(y)
          }
        }
      }
    }
  }
  return true
}

/** ヒントだけから解き、一意に解けるかを判定する。 */
export function checkUniqueness(puzzle: Puzzle, options: SolveOptions = {}): UniquenessResult {
  const now = options.now ?? (() => Date.now())
  const deadline = now() + (options.timeLimitMs ?? 3000)
  let steps = 0
  const stop = () => {
    // 時計を見るのは時々にする
    if (++steps % 64 !== 0) return false
    return now() > deadline || (options.shouldStop?.() ?? false)
  }

  const root = Candidates.initial(puzzle)
  const first = propagate(puzzle, root, stop)
  if (first === 'stopped') return { kind: 'timed-out' }
  if (first === false) {
    // ヒントが正解図から導出されていれば起きない
    throw new Error('the clues are contradictory')
  }
  if (root.solved()) return { kind: 'line-solvable' }

  const solutions: Grid<SolutionCell>[] = []
  let stopped = false
  const search = (c: Candidates): void => {
    if (stopped || solutions.length >= 2) return
    // 候補がいちばん少ないマスから仮置きする
    let best = -1
    let bestCount = Infinity
    for (let i = 0; i < c.cells.length; i++) {
      const v = c.cells[i] as number
      if ((v & (v - 1)) === 0) continue
      const count = popcount(v)
      if (count < bestCount) {
        best = i
        bestCount = count
        if (count === 2) break
      }
    }
    if (best < 0) {
      solutions.push(c.toGrid())
      return
    }
    const v = c.cells[best] as number
    for (let bit = 1; bit <= v; bit <<= 1) {
      if (!(v & bit)) continue
      const next = c.clone()
      next.cells[best] = bit
      const ok = propagate(puzzle, next, stop)
      if (ok === 'stopped') {
        stopped = true
        return
      }
      if (ok) search(next)
      if (stopped || solutions.length >= 2) return
    }
  }
  search(root)

  if (solutions.length >= 2) {
    return { kind: 'multiple', solutions: [solutions[0]!, solutions[1]!] }
  }
  if (stopped) return { kind: 'timed-out' }
  return { kind: 'needs-guessing' }
}

function popcount(v: number): number {
  let n = 0
  while (v) {
    v &= v - 1
    n++
  }
  return n
}
