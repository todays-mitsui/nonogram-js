import { describe, expect, it } from 'vitest'
import { BLANK, CROSSED, emptyBoard, type Mark } from './board'
import { encodeCells } from './cells-codec'
import { derivePuzzle } from './clue'
import { decodeSolution } from './format'
import { Grid } from './grid'
import {
  computePuzzleId,
  decodeProgress,
  encodeProgress,
  puzzleIdInput,
  storageKey,
} from './progress'

const HEART = 'v2;5x5;5x5;#000;Y2BkAEI4ADEZGIBCDAA'

async function heartPuzzle(palette?: string[]) {
  const { solution, palette: p } = await decodeSolution(HEART)
  return derivePuzzle(solution, palette ?? p)
}

describe('PuzzleId(PROGRESS.md の例)', () => {
  it('ハートの正規形と ID', async () => {
    const puzzle = await heartPuzzle()
    expect(puzzleIdInput(puzzle)).toBe('5x5;1:0,1:0/5:0/5:0/3:0/1:0;2:0/4:0/4:0/4:0/2:0')
    expect(await computePuzzleId(puzzle)).toBe(
      '09d7079bd6456795a915865d5926b4fa346602a5d940d1f5ac1ab07862de6c01',
    )
  })

  it('色の値も色数も含めない', async () => {
    const id = await computePuzzleId(await heartPuzzle())
    expect(await computePuzzleId(await heartPuzzle(['#f00']))).toBe(id)
    expect(await computePuzzleId(await heartPuzzle(['#000', '#fff']))).toBe(id)
  })

  it('空ラインは空文字列', async () => {
    const { solution } = await decodeSolution(
      `v2;2x1;2x1;#000;${await encodeCells(Uint8Array.from([1, 0]))}`,
    )
    expect(puzzleIdInput(derivePuzzle(solution, ['#000']))).toBe('2x1;1:0;1:0/')
  })

  it('保存キー', () => {
    expect(storageKey('abc')).toBe('todays-mitsui/nonogram:progress:abc')
  })
})

// PROGRESS.md の例: 1行目にバツと塗りを交互に、2行目を全部塗った途中の状態
const exampleBoard = Grid.fromRows<Mark>([
  [CROSSED, 0, CROSSED, 0, CROSSED],
  [0, 0, 0, 0, 0],
  [BLANK, BLANK, BLANK, BLANK, BLANK],
  [BLANK, BLANK, BLANK, BLANK, BLANK],
  [BLANK, BLANK, BLANK, BLANK, BLANK],
])

describe('進捗コード', () => {
  it('PROGRESS.md の例を読める', async () => {
    const progress = await decodeProgress('p1;5x5;0;Y2RiBEIQYEAFAA', await heartPuzzle())
    expect(progress?.revealed).toBe(false)
    expect(progress?.board.equals(exampleBoard)).toBe(true)
  })

  it('往復する', async () => {
    const puzzle = await heartPuzzle(['#f00', '#0f0', '#00f'])
    const board = exampleBoard.set(4, 4, 2)
    const code = await encodeProgress({ board, revealed: true })
    expect(code.startsWith('p1;5x5;1;')).toBe(true)
    const progress = await decodeProgress(code, puzzle)
    expect(progress?.revealed).toBe(true)
    expect(progress?.board.equals(board)).toBe(true)
  })
})

describe('復元時に捨てる条件', async () => {
  const puzzle = await heartPuzzle()
  const blank = await encodeCells(new Uint8Array(25))

  it.each([
    ['先頭が p1 でない', `p2;5x5;0;${blank}`],
    ['正解図コード', HEART],
    ['フィールド数が 4 でない', `p1;5x5;0;${blank};x`],
    ['フィールド数が足りない', `p1;5x5;0`],
    ['サイズがパズルと一致しない', `p1;5x4;0;${await encodeCells(new Uint8Array(20))}`],
    ['正解表示が 0 / 1 でない', `p1;5x5;2;${blank}`],
    ['マスデータが展開できない', 'p1;5x5;0;!!!!'],
    ['長さが合わない', `p1;5x5;0;${await encodeCells(new Uint8Array(24))}`],
    [
      'マスの値が色数 + 2 以上',
      `p1;5x5;0;${await encodeCells(Uint8Array.from({ length: 25 }, (_, i) => (i === 0 ? 3 : 0)))}`,
    ],
  ])('%s', async (_, code) => {
    expect(await decodeProgress(code, puzzle)).toBeNull()
  })

  it('色数 + 1 までは受け付ける', async () => {
    const code = `p1;5x5;0;${await encodeCells(Uint8Array.from({ length: 25 }, (_, i) => (i === 0 ? 2 : 0)))}`
    expect((await decodeProgress(code, puzzle))?.board.get(0, 0)).toBe(0)
  })

  it('全マス未記入', async () => {
    const progress = await decodeProgress(`p1;5x5;0;${blank}`, puzzle)
    expect(progress?.board.equals(emptyBoard(5, 5))).toBe(true)
  })
})
