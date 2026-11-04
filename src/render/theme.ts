/**
 * 配色(README §4.2)。ライト / ダークの2種。マス領域は、ダークでも常に明るい背景のままにする。
 * 値は画面イメージ(デザインキャンバス)に合わせている。
 */

export interface Theme {
  /** ヒント領域の文字(モノクロ問題)。 */
  readonly clueText: string
  /** カラー問題のヒント項目の縁取り(ウィジェットの背景色)。 */
  readonly clueChipGap: string
  readonly cellBackground: string
  readonly gridLine: string
  readonly majorLine: string
  readonly cross: string
}

export const lightTheme: Theme = {
  clueText: '#1F1F1E',
  clueChipGap: '#FFFFFF',
  cellBackground: '#FFFFFF',
  gridLine: '#D2D2CD',
  majorLine: '#5E5E59',
  cross: '#B8B8B3',
}

export const darkTheme: Theme = {
  ...lightTheme,
  clueText: '#ECECEA',
  clueChipGap: '#1F2023',
}

/** 解けたとき: ヒントと罫線を薄くして絵を目立たせる。 */
export const SOLVED_CLUE_OPACITY = 0.3
export const SATISFIED_CLUE_OPACITY = 0.32
export const solvedLines = { gridLine: '#EEEEEA', majorLine: '#D6D6D1' } as const

/** ウィジェットの DOM 部分の配色(CSS カスタムプロパティとして Shadow DOM に入れる)。 */
export const widgetCss = {
  light: {
    bg: '#FFFFFF',
    border: '#DADAD6',
    text: '#1F1F1E',
    muted: '#62625E',
    'btn-bg': '#F4F4F2',
    'btn-border': '#CFCFCB',
    accent: '#2563C9',
    'accent-soft': '#E6EEFB',
    'on-accent': '#FFFFFF',
    overlay: 'rgba(20, 20, 20, 0.45)',
    'dialog-bg': '#FFFFFF',
  },
  dark: {
    bg: '#1F2023',
    border: '#3A3B40',
    text: '#ECECEA',
    muted: '#A6A6A1',
    'btn-bg': '#2A2B2F',
    'btn-border': '#4A4B51',
    accent: '#8DB2F2',
    'accent-soft': '#2B3652',
    'on-accent': '#14161A',
    overlay: 'rgba(0, 0, 0, 0.55)',
    'dialog-bg': '#2A2B2F',
  },
} as const

/** 色見本の上の文字色(白か黒)。 */
export function textOn(hex: string): string {
  const full =
    hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex.toLowerCase()
  const n = parseInt(full.slice(1), 16)
  const l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return l > 150 ? '#1A1A1A' : '#FFFFFF'
}
