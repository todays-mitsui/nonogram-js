import { describe, expect, it } from 'vitest'
import { encodeCells, fromBase64Url, toBase64Url } from './cells-codec'
import {
  decodeSolution,
  encodeSolution,
  SolutionCodeError,
  type SolutionCodeErrorReason,
} from './format'
import { Grid } from './grid'
import { createSolution, crop, EMPTY, type SolutionCell } from './solution'

const _ = EMPTY

/** 数字の行(0 = 背景、i + 1 = 色 i)から grid を作る。FORMAT.md のバイト列の表記に合わせる。 */
function gridOf(rows: number[][]): Grid<SolutionCell> {
  return Grid.fromRows(rows.map((row) => row.map((v) => (v === 0 ? _ : v - 1))))
}

const heart = gridOf([
  [0, 1, 0, 1, 0],
  [1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1],
  [0, 1, 1, 1, 0],
  [0, 0, 1, 0, 0],
])

const colorExample = gridOf([
  [1, 1, 2, 0, 0, 2],
  [1, 0, 2, 0, 0, 0],
  [1, 1, 2, 0, 2, 2],
])

async function reasonOf(code: string): Promise<SolutionCodeErrorReason> {
  try {
    await decodeSolution(code)
  } catch (e) {
    if (e instanceof SolutionCodeError) return e.reason
    throw e
  }
  throw new Error('expected decodeSolution to fail')
}

async function cellsOf(bytes: number[]): Promise<string> {
  return encodeCells(Uint8Array.from(bytes))
}

describe('decodeSolution: FORMAT.md の例', () => {
  it('5x5 のモノクロ問題(ハート)', async () => {
    const { solution, palette } = await decodeSolution('v2;5x5;5x5;#000;Y2BkAEI4ADEZGIBCDAA')
    expect(palette).toEqual(['#000'])
    expect(solution.frame).toEqual({ width: 5, height: 5 })
    expect(solution.grid.equals(heart)).toBe(true)
  })

  it('可視領域 4x3、データ領域 6x3 の2色のカラー問題(作問側の保存)', async () => {
    const { solution, palette } = await decodeSolution(
      'v2;4x3;6x3;#F33;#3366cc;Y2RkYmBgYmQAkgyMQDYTEwA',
    )
    expect(palette).toEqual(['#F33', '#3366cc'])
    expect(solution.frame).toEqual({ width: 4, height: 3 })
    expect(solution.grid.equals(colorExample)).toBe(true)
  })
})

describe('encodeSolution', () => {
  it('デコードすると元に戻る', async () => {
    const solution = createSolution(colorExample, { width: 4, height: 3 })
    const code = await encodeSolution(solution, ['#F33', '#3366cc'])
    expect(code.startsWith('v2;4x3;6x3;#F33;#3366cc;')).toBe(true)
    const decoded = await decodeSolution(code)
    expect(decoded.solution.grid.equals(colorExample)).toBe(true)
    expect(decoded.solution.frame).toEqual({ width: 4, height: 3 })
  })

  it('データ領域を最小の長方形に切り詰める', async () => {
    // 右と下に背景だけの列・行がある 7x4 の grid
    const solution = createSolution(colorExample.resize(7, 4, _), { width: 4, height: 3 })
    const code = await encodeSolution(solution, ['#F33', '#3366cc'])
    expect(code.split(';')[2]).toBe('6x3')
  })

  it('可視領域より小さくは切り詰めない', async () => {
    const solution = createSolution(Grid.filled<SolutionCell>(5, 5, _))
    const code = await encodeSolution(solution, ['#000'])
    expect(code.split(';').slice(1, 3)).toEqual(['5x5', '5x5'])
  })

  it('切り抜いてから書き出すと 可視領域 = データ領域', async () => {
    const solution = crop(createSolution(colorExample, { width: 4, height: 3 }))
    const code = await encodeSolution(solution, ['#F33', '#3366cc'])
    expect(code.split(';').slice(1, 3)).toEqual(['4x3', '4x3'])
  })

  it('パレット色の値を正規化しない', async () => {
    const code = await encodeSolution(createSolution(heart), ['#aBc'])
    expect(code.split(';')[3]).toBe('#aBc')
  })

  it('不正な入力は RangeError', async () => {
    await expect(encodeSolution(createSolution(heart), [])).rejects.toThrow(RangeError)
    await expect(encodeSolution(createSolution(heart), ['red'])).rejects.toThrow(RangeError)
    const outOfPalette = createSolution(heart.set(0, 0, 1))
    await expect(encodeSolution(outOfPalette, ['#000'])).rejects.toThrow(RangeError)
  })
})

describe('decodeSolution: 受け付けるもの', () => {
  it('最小でないデータ領域', async () => {
    const cells = await cellsOf([1, 0, 0, 0, 0, 0])
    const { solution } = await decodeSolution(`v2;1x1;3x2;#000;${cells}`)
    expect(solution.grid.size).toEqual({ width: 3, height: 2 })
  })

  it('base64url のパディング', async () => {
    const { solution } = await decodeSolution('v2;5x5;5x5;#000;Y2BkAEI4ADEZGIBCDAA=')
    expect(solution.grid.equals(heart)).toBe(true)
  })

  it('16進数字の大文字・小文字', async () => {
    const cells = await cellsOf([1])
    const { palette } = await decodeSolution(`v2;1x1;1x1;#FfAa00;${cells}`)
    expect(palette).toEqual(['#FfAa00'])
  })
})

describe('decodeSolution: 不正とする条件(FORMAT.md)', () => {
  it('フィールド数が 5 未満', async () => {
    expect(await reasonOf('v2;5x5;5x5;Y2BkAEI4ADEZGIBCDAA')).toEqual({ kind: 'too-few-fields' })
  })

  it('先頭が v2 でない', async () => {
    expect(await reasonOf('v1;5x5;5x5;#000;Y2BkAEI4ADEZGIBCDAA')).toEqual({
      kind: 'unsupported-version',
      version: 'v1',
    })
  })

  it.each(['5', '5x', 'x5', '5X5', '0x5', '5x0', '-1x5', '1.5x5', ' 5x5'])(
    'サイズが不正: %j',
    async (size) => {
      expect(await reasonOf(`v2;${size};5x5;#000;Y2BkAEI4ADEZGIBCDAA`)).toEqual({
        kind: 'invalid-size',
        value: size,
      })
    },
  )

  it('可視領域がデータ領域より大きい', async () => {
    expect(await reasonOf('v2;6x5;5x5;#000;Y2BkAEI4ADEZGIBCDAA')).toEqual({
      kind: 'frame-exceeds-extent',
    })
    expect(await reasonOf('v2;5x6;5x5;#000;Y2BkAEI4ADEZGIBCDAA')).toEqual({
      kind: 'frame-exceeds-extent',
    })
  })

  it.each(['#00', '#0000', '#00000000', 'red', '000', '#GGG', ''])(
    'パレット色が不正: %j',
    async (color) => {
      expect(await reasonOf(`v2;5x5;5x5;${color};Y2BkAEI4ADEZGIBCDAA`)).toEqual({
        kind: 'invalid-color',
        value: color,
      })
    },
  )

  it('色数が 255 を超える', async () => {
    const cells = await cellsOf([1])
    const palette = Array.from({ length: 256 }, () => '#000').join(';')
    expect(await reasonOf(`v2;1x1;1x1;${palette};${cells}`)).toEqual({
      kind: 'too-many-colors',
      count: 256,
    })
    const ok = Array.from({ length: 255 }, () => '#000').join(';')
    await expect(decodeSolution(`v2;1x1;1x1;${ok};${cells}`)).resolves.toBeDefined()
  })

  it('マスデータが base64url として不正', async () => {
    expect(await reasonOf('v2;5x5;5x5;#000;Y2Bk+EI4')).toEqual({ kind: 'invalid-cells' })
    expect(await reasonOf('v2;5x5;5x5;#000;Y2BkA')).toEqual({ kind: 'invalid-cells' })
  })

  it('マスデータが deflate として展開できない', async () => {
    expect(await reasonOf(`v2;5x5;5x5;#000;${toBase64Url(Uint8Array.from([0xff, 0xff]))}`)).toEqual(
      {
        kind: 'invalid-cells',
      },
    )
  })

  it('展開後の長さがデータ領域と一致しない', async () => {
    const cells = await cellsOf([0, 1, 0])
    expect(await reasonOf(`v2;2x2;2x2;#000;${cells}`)).toEqual({
      kind: 'cells-length-mismatch',
      expected: 4,
      actual: 3,
    })
  })

  it('マスの値が N + 1 以上', async () => {
    const cells = await cellsOf([0, 1, 2, 0])
    expect(await reasonOf(`v2;2x2;2x2;#000;${cells}`)).toEqual({
      kind: 'invalid-cell-value',
      value: 2,
    })
  })
})

describe('base64url', () => {
  it('往復する', () => {
    for (let n = 0; n < 10; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 97 + 13) & 0xff)
      expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes)
    }
  })

  it('パディングを付けない', () => {
    expect(toBase64Url(Uint8Array.from([0xfb, 0xff]))).toBe('-_8')
  })
})
