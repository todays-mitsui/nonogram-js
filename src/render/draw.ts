/**
 * Canvas 2D への描画。プレイモードとエディタで共有する。
 */

import { CROSSED, isFilled, type Mark } from '../core/board'
import type { Clue, Puzzle, Satisfaction } from '../core/clue'
import type { Grid } from '../core/grid'
import type { Layout } from './layout'
import {
  SATISFIED_CLUE_OPACITY,
  SOLVED_CLUE_OPACITY,
  solvedLines,
  textOn,
  type Theme,
} from './theme'

export interface DrawState {
  readonly puzzle: Puzzle
  /** 表示するマス。正解表示中は正解図を Mark に直したもの。 */
  readonly board: Grid<Mark>
  readonly satisfaction: Satisfaction
  readonly solved: boolean
  readonly showGridLines: boolean
  readonly theme: Theme
}

/** キャンバスの大きさを layout と devicePixelRatio に合わせる。 */
export function resizeCanvas(canvas: HTMLCanvasElement, layout: Layout, dpr: number): void {
  const w = Math.round(layout.width * dpr)
  const h = Math.round(layout.height * dpr)
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  canvas.style.width = `${layout.width}px`
  canvas.style.height = `${layout.height}px`
}

export function draw(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  state: DrawState,
  dpr: number,
): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, layout.width, layout.height)
  drawClues(ctx, layout, state)
  drawCells(ctx, layout, state)
  drawGridLines(ctx, layout, state)
}

function drawClues(ctx: CanvasRenderingContext2D, layout: Layout, state: DrawState): void {
  const { puzzle, satisfaction, solved } = state
  const s = layout.cellSize
  const fontSize = Math.max(11, Math.round(s * 0.55))
  ctx.font = `500 ${fontSize}px system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const opacity = (satisfied: boolean) =>
    solved ? SOLVED_CLUE_OPACITY : satisfied ? SATISFIED_CLUE_OPACITY : 1

  puzzle.rowClues.forEach((clue, y) => {
    const items = itemsOf(clue)
    const top = layout.cellAreaY + y * s
    items.forEach((entry, i) => {
      const left = layout.cellAreaX - (items.length - i) * s
      drawClueItem(ctx, state, entry, left, top, s, opacity(satisfaction.rows[y] ?? false))
    })
  })
  puzzle.columnClues.forEach((clue, x) => {
    const items = itemsOf(clue)
    const left = layout.cellAreaX + x * s
    items.forEach((entry, i) => {
      const top = layout.cellAreaY - (items.length - i) * s
      drawClueItem(ctx, state, entry, left, top, s, opacity(satisfaction.columns[x] ?? false))
    })
  })
  ctx.globalAlpha = 1
}

/** 空ラインは「0」を1項目として表示する。 */
const itemsOf = (clue: Clue) => (clue.length ? clue : [null])

function drawClueItem(
  ctx: CanvasRenderingContext2D,
  state: DrawState,
  entry: Clue[number] | null,
  left: number,
  top: number,
  s: number,
  alpha: number,
): void {
  ctx.globalAlpha = alpha
  const isColor = state.puzzle.palette.length > 1
  if (entry && isColor) {
    const color = state.puzzle.palette[entry.paletteIndex] ?? '#000'
    ctx.fillStyle = color
    roundRect(ctx, left + 1, top + 1, s - 2, s - 2, Math.min(4, s / 6))
    ctx.fill()
    ctx.fillStyle = textOn(color)
  } else {
    ctx.fillStyle = state.theme.clueText
  }
  ctx.fillText(entry ? String(entry.length) : '0', left + s / 2, top + s / 2 + 1)
}

function drawCells(ctx: CanvasRenderingContext2D, layout: Layout, state: DrawState): void {
  const { board, puzzle, theme } = state
  const s = layout.cellSize
  ctx.fillStyle = theme.cellBackground
  ctx.fillRect(layout.cellAreaX, layout.cellAreaY, board.width * s, board.height * s)

  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const mark = board.get(x, y)
      const left = layout.cellAreaX + x * s
      const top = layout.cellAreaY + y * s
      if (isFilled(mark)) {
        ctx.fillStyle = puzzle.palette[mark] ?? '#000'
        ctx.fillRect(left, top, s, s)
      } else if (mark === CROSSED && !state.solved && state.showGridLines) {
        drawCross(ctx, theme, left, top, s)
      }
    }
  }
}

/** バツ: マスの四隅から 20% 内側までの2本の対角線。線は 1.25px(README §4.2)。 */
function drawCross(
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  left: number,
  top: number,
  s: number,
): void {
  const inset = s * 0.2
  ctx.strokeStyle = theme.cross
  ctx.lineWidth = 1.25
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(left + inset, top + inset)
  ctx.lineTo(left + s - inset, top + s - inset)
  ctx.moveTo(left + s - inset, top + inset)
  ctx.lineTo(left + inset, top + s - inset)
  ctx.stroke()
}

function drawGridLines(ctx: CanvasRenderingContext2D, layout: Layout, state: DrawState): void {
  const { board } = state
  const s = layout.cellSize
  const x0 = layout.cellAreaX
  const y0 = layout.cellAreaY
  const w = board.width * s
  const h = board.height * s
  const colors = state.solved
    ? solvedLines
    : { gridLine: state.theme.gridLine, majorLine: state.theme.majorLine }

  const line = (ax: number, ay: number, bx: number, by: number) => {
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.stroke()
  }
  ctx.lineCap = 'butt'

  if (state.showGridLines) {
    ctx.strokeStyle = colors.gridLine
    ctx.lineWidth = 1
    for (let x = 1; x < board.width; x++) {
      if (x % 5) line(x0 + x * s + 0.5, y0, x0 + x * s + 0.5, y0 + h)
    }
    for (let y = 1; y < board.height; y++) {
      if (y % 5) line(x0, y0 + y * s + 0.5, x0 + w, y0 + y * s + 0.5)
    }
    ctx.strokeStyle = colors.majorLine
    ctx.lineWidth = 2
    for (let x = 5; x < board.width; x += 5) line(x0 + x * s, y0, x0 + x * s, y0 + h)
    for (let y = 5; y < board.height; y += 5) line(x0, y0 + y * s, x0 + w, y0 + y * s)
  }
  ctx.strokeStyle = colors.majorLine
  ctx.lineWidth = 2
  ctx.strokeRect(x0 + 1, y0 + 1, w - 2, h - 2)
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}
