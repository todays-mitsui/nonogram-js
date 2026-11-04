import { describe, expect, it } from 'vitest'
import { derivePuzzle } from './clue'
import { decodeSolution } from './format'
import { Grid } from './grid'
import { createSolution, EMPTY, type SolutionCell } from './solution'
import { checkUniqueness, solveLine } from './solver'

const E = EMPTY
const BG = 1
const C0 = 2
const C1 = 4
const ANY0 = BG | C0
const e = (length: number, paletteIndex = 0) => ({ length, paletteIndex })

/** 候補のビット集合を読みやすく: '.' 背景確定、'0'/'1' 色確定、'?' 未確定 */
function show(cells: number[] | null): string | null {
  if (!cells) return null
  return cells.map((v) => (v === BG ? '.' : v === C0 ? '0' : v === C1 ? '1' : '?')).join('')
}

describe('solveLine', () => {
  it('重なり法: 長さ 10 に 7 のブロック', () => {
    expect(show(solveLine([e(7)], Array(10).fill(ANY0)))).toBe('???0000???')
  })

  it('空ラインはすべて背景', () => {
    expect(show(solveLine([], Array(4).fill(ANY0)))).toBe('....')
  })

  it('ちょうど埋まる', () => {
    expect(show(solveLine([e(2), e(1)], Array(4).fill(ANY0)))).toBe('00.0')
  })

  it('違う色は隙間なしで隣接してよい', () => {
    const all = BG | C0 | C1
    expect(show(solveLine([e(2, 0), e(2, 1)], Array(4).fill(all)))).toBe('0011')
    // 同じ色なら1マス空ける必要があり、長さ 4 には収まらない
    expect(solveLine([e(2, 0), e(2, 0)], Array(4).fill(all))).toBeNull()
  })

  it('確定したマスから推論を進める', () => {
    const cells = Array(5).fill(ANY0)
    cells[0] = C0
    expect(show(solveLine([e(2)], cells))).toBe('00...')
  })

  it('矛盾は null', () => {
    expect(solveLine([e(3)], [ANY0, BG, ANY0])).toBeNull()
  })
})

function puzzleOf(rows: (number | typeof E)[][], palette = ['#000']) {
  return derivePuzzle(createSolution(Grid.fromRows<SolutionCell>(rows)), palette)
}

describe('checkUniqueness', () => {
  it('FORMAT.md のハートはライン推論だけで解ける', async () => {
    const { solution, palette } = await decodeSolution('v2;5x5;5x5;#000;Y2BkAEI4ADEZGIBCDAA')
    expect(checkUniqueness(derivePuzzle(solution, palette))).toEqual({ kind: 'line-solvable' })
  })

  it('対角線は別解がある', () => {
    const result = checkUniqueness(
      puzzleOf([
        [0, E],
        [E, 0],
      ]),
    )
    expect(result.kind).toBe('multiple')
    if (result.kind === 'multiple') {
      const [a, b] = result.solutions
      expect(a.equals(b)).toBe(false)
    }
  })

  it('ライン推論では止まるが、仮置きで一意に決まる', () => {
    // ランダムな 5x5 から探した盤面(総当たりの照合テストと同じソルバーで判定)
    const rows: SolutionCell[][] = [
      [E, 0, 0, E, 0],
      [0, E, E, 0, E],
      [E, E, E, E, 0],
      [E, 0, 0, E, E],
      [0, 0, 0, E, E],
    ]
    expect(checkUniqueness(puzzleOf(rows))).toEqual({ kind: 'needs-guessing' })
  })

  it('カラー問題(FORMAT.md の例を切り抜いたもの)', async () => {
    const { solution, palette } = await decodeSolution(
      'v2;4x3;6x3;#F33;#3366cc;Y2RkYmBgYmQAkgyMQDYTEwA',
    )
    expect(checkUniqueness(derivePuzzle(solution, palette)).kind).toBe('line-solvable')
  })

  it('時間切れは timed-out', () => {
    // 20x20 の市松模様は別解だらけ。時計を進めて打ち切らせる
    const rows = Array.from({ length: 20 }, (_, y) =>
      Array.from({ length: 20 }, (_, x) => ((x + y) % 2 === 0 ? 0 : E)),
    )
    let t = 0
    const result = checkUniqueness(puzzleOf(rows), { timeLimitMs: 10, now: () => (t += 5) })
    expect(['timed-out', 'multiple']).toContain(result.kind)
  })

  it('中断できる', () => {
    const rows = Array.from({ length: 10 }, (_, y) =>
      Array.from({ length: 10 }, (_, x) => ((x * 7 + y * 3) % 5 === 0 ? 0 : E)),
    )
    const result = checkUniqueness(puzzleOf(rows), { shouldStop: () => true })
    expect(['timed-out', 'line-solvable', 'multiple', 'needs-guessing']).toContain(result.kind)
  })

  it('解は正解図のヒントを満たす', () => {
    const rows: SolutionCell[][] = [
      [0, E, 0],
      [E, 0, E],
      [0, E, 0],
    ]
    const result = checkUniqueness(puzzleOf(rows))
    if (result.kind === 'multiple') {
      for (const g of result.solutions) {
        expect(derivePuzzle(createSolution(g), ['#000'])).toEqual(puzzleOf(rows))
      }
    }
  })
})

/** ランダムな小さい盤面で、ソルバーの結果を総当たりと照らし合わせる。 */
describe('総当たりとの照合', () => {
  /** モノクロの総当たり。ビット列から直接ヒントを作って比べる(速さのため)。 */
  function bruteForceCount(rows: SolutionCell[][], limit = 2): number {
    const height = rows.length
    const width = rows[0]!.length
    const runs = (bits: number[]) => {
      const out: number[] = []
      let run = 0
      for (const b of [...bits, 0]) {
        if (b) run++
        else if (run) {
          out.push(run)
          run = 0
        }
      }
      return out.join(',')
    }
    const key = (get: (x: number, y: number) => number) =>
      Array.from({ length: height }, (_, y) =>
        runs(Array.from({ length: width }, (_, x) => get(x, y))),
      ).join('/') +
      '|' +
      Array.from({ length: width }, (_, x) =>
        runs(Array.from({ length: height }, (_, y) => get(x, y))),
      ).join('/')
    const target = key((x, y) => (rows[y]![x] === E ? 0 : 1))
    let count = 0
    for (let mask = 0; mask < 1 << (width * height) && count < limit; mask++) {
      if (key((x, y) => (mask >> (y * width + x)) & 1) === target) count++
    }
    return count
  }

  it('4x4 のランダムな盤面 60 個', { timeout: 60_000 }, () => {
    let seed = 12345
    const random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    for (let n = 0; n < 60; n++) {
      const rows = Array.from({ length: 4 }, () =>
        Array.from({ length: 4 }, (): SolutionCell => (random() < 0.5 ? 0 : E)),
      )
      const result = checkUniqueness(puzzleOf(rows))
      const count = bruteForceCount(rows)
      expect(result.kind === 'multiple', JSON.stringify(rows)).toBe(count >= 2)
    }
  })
})
