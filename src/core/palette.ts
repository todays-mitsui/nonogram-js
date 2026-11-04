/**
 * パレット(GLOSSARY §3)。
 */

/** パレット内の位置。0 始まり。 */
export type PaletteIndex = number

/** パレット色。`#RGB` または `#RRGGBB`。名前は持たない。 */
export type PaletteColor = string

/** パズルで使う色の順序付きリスト。背景は含めない。 */
export type Palette = readonly PaletteColor[]

/** 正解図コードで表せる色数の上限(FORMAT.md)。 */
export const MAX_PALETTE_SIZE = 255

const COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

export function isPaletteColor(value: string): value is PaletteColor {
  return COLOR_PATTERN.test(value)
}

/** モノクロ問題か。パレットから導出し、別に保存しない。 */
export function isMonochrome(palette: Palette): boolean {
  return palette.length === 1
}

/** UI 上の色の番号(「色1」「色2」…)。 */
export function displayNumber(index: PaletteIndex): number {
  return index + 1
}
