/**
 * 正解図コード v2(docs/spec/FORMAT.md)のエンコードとデコード。
 *
 *   v2;{可視領域};{データ領域};{色0};…;{色N-1};{マスデータ}
 */

import { CellsDecodeError, decodeCells, encodeCells } from './cells-codec'
import { Grid, type Size } from './grid'
import { isPaletteColor, MAX_PALETTE_SIZE, type Palette } from './palette'
import { createSolution, EMPTY, trimToExtent, type Solution, type SolutionCell } from './solution'

export const SOLUTION_FORMAT_VERSION = 'v2'

/** FORMAT.md「デコード時に不正とする条件」に対応する理由。UI の文言は i18n 側で引く。 */
export type SolutionCodeErrorReason =
  | { readonly kind: 'too-few-fields' }
  | { readonly kind: 'unsupported-version'; readonly version: string }
  | { readonly kind: 'invalid-size'; readonly value: string }
  | { readonly kind: 'frame-exceeds-extent' }
  | { readonly kind: 'invalid-color'; readonly value: string }
  | { readonly kind: 'too-many-colors'; readonly count: number }
  | { readonly kind: 'invalid-cells' }
  | { readonly kind: 'cells-length-mismatch'; readonly expected: number; readonly actual: number }
  | { readonly kind: 'invalid-cell-value'; readonly value: number }

export class SolutionCodeError extends Error {
  override readonly name = 'SolutionCodeError'
  readonly reason: SolutionCodeErrorReason

  constructor(reason: SolutionCodeErrorReason, options?: ErrorOptions) {
    super(`invalid solution code: ${reason.kind}`, options)
    this.reason = reason
  }
}

export interface DecodedSolution {
  readonly solution: Solution
  readonly palette: Palette
}

/**
 * 正解図コードにする。データ領域は「可視領域と背景以外のマスをすべて含む最小の長方形」に切り詰める。
 * 書き出し(解答者向け)には、先に crop() した正解図を渡す。
 * パレット色の値は渡されたとおりに出力する(正規化しない)。
 */
export async function encodeSolution(solution: Solution, palette: Palette): Promise<string> {
  if (palette.length < 1 || palette.length > MAX_PALETTE_SIZE) {
    throw new RangeError(`palette must have 1 to ${MAX_PALETTE_SIZE} colors`)
  }
  for (const color of palette) {
    if (!isPaletteColor(color)) throw new RangeError(`invalid palette color "${color}"`)
  }
  const { grid, frame } = trimToExtent(solution)
  const bytes = Uint8Array.from(grid.toCells(), (cell) => {
    if (cell === EMPTY) return 0
    if (!Number.isInteger(cell) || cell < 0 || cell >= palette.length) {
      throw new RangeError(`cell value ${cell} is not in the palette`)
    }
    return cell + 1
  })
  return [
    SOLUTION_FORMAT_VERSION,
    formatSize(frame),
    formatSize(grid.size),
    ...palette,
    await encodeCells(bytes),
  ].join(';')
}

/** 不正なら SolutionCodeError。最小でないデータ領域も受け付ける。 */
export async function decodeSolution(code: string): Promise<DecodedSolution> {
  const fields = code.trim().split(';')
  if (fields.length < 5) throw new SolutionCodeError({ kind: 'too-few-fields' })

  const [version, frameField, extentField] = fields as [string, string, string]
  if (version !== SOLUTION_FORMAT_VERSION) {
    throw new SolutionCodeError({ kind: 'unsupported-version', version })
  }
  const frame = parseSize(frameField)
  const extent = parseSize(extentField)
  if (frame.width > extent.width || frame.height > extent.height) {
    throw new SolutionCodeError({ kind: 'frame-exceeds-extent' })
  }

  const palette = fields.slice(3, -1)
  if (palette.length > MAX_PALETTE_SIZE) {
    throw new SolutionCodeError({ kind: 'too-many-colors', count: palette.length })
  }
  for (const color of palette) {
    if (!isPaletteColor(color)) throw new SolutionCodeError({ kind: 'invalid-color', value: color })
  }

  let bytes: Uint8Array
  try {
    bytes = await decodeCells(fields.at(-1) as string)
  } catch (cause) {
    if (cause instanceof CellsDecodeError) {
      throw new SolutionCodeError({ kind: 'invalid-cells' }, { cause })
    }
    throw cause
  }
  const expected = extent.width * extent.height
  if (bytes.length !== expected) {
    throw new SolutionCodeError({ kind: 'cells-length-mismatch', expected, actual: bytes.length })
  }
  const cells = Array.from(bytes, (byte): SolutionCell => {
    if (byte > palette.length)
      throw new SolutionCodeError({ kind: 'invalid-cell-value', value: byte })
    return byte === 0 ? EMPTY : byte - 1
  })

  return {
    solution: createSolution(Grid.fromCells(extent.width, extent.height, cells), frame),
    palette,
  }
}

function formatSize({ width, height }: Size): string {
  return `${width}x${height}`
}

function parseSize(value: string): Size {
  const match = /^(\d+)x(\d+)$/.exec(value)
  const width = Number(match?.[1])
  const height = Number(match?.[2])
  if (!match || width < 1 || height < 1)
    throw new SolutionCodeError({ kind: 'invalid-size', value })
  return { width, height }
}
