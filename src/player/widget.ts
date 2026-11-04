/**
 * ウィジェット: 埋め込み要素の Shadow DOM の中に描画するノノグラム一式(GLOSSARY §7)。
 * キャンバス(Canvas 2D)・状態の表示・ツールバー・確認ダイアログ・aria-live の通知から成る。
 */

import type { Grid } from '../core/grid'
import { displayNumber, isMonochrome } from '../core/palette'
import type { SolutionCell } from '../core/solution'
import { availableTools, type Operation, type Tool } from '../core/tool'
import type { Puzzle } from '../core/clue'
import { player as t } from '../i18n/ja'
import { draw, resizeCanvas } from '../render/draw'
import { cellAt, cellAtUnclamped, computeLayout, type Layout } from '../render/layout'
import { darkTheme, lightTheme } from '../render/theme'
import { PlayerState, type Change } from './state'
import type { ProgressStore } from './storage'
import { css } from './styles'

export type AspectRatio = '3:4' | '1:1' | '4:3'

export interface WidgetOptions {
  readonly puzzle: Puzzle
  readonly solution: Grid<SolutionCell>
  readonly aspectRatio: AspectRatio
  readonly store: ProgressStore | null
}

/** エラーをウィジェットの代わりに表示する(README §4.6)。 */
export function renderError(root: ShadowRoot, title: string, detail: string): void {
  root.replaceChildren(
    style(),
    h('div', { class: 'widget error', role: 'alert' }, [
      h('p', { class: 'title' }, [title]),
      h('p', { class: 'detail' }, [detail]),
    ]),
  )
}

export class Widget {
  readonly #state: PlayerState
  readonly #store: ProgressStore | null
  readonly #canvas: HTMLCanvasElement
  readonly #ctx: CanvasRenderingContext2D
  readonly #canvasArea: HTMLElement
  readonly #status: HTMLElement
  readonly #live: HTMLElement
  readonly #toolButtons: { tool: Tool; button: HTMLButtonElement }[] = []
  readonly #undoButton: HTMLButtonElement
  readonly #redoButton: HTMLButtonElement
  readonly #gridButton: HTMLButtonElement
  readonly #giveUpButton: HTMLButtonElement
  readonly #dialog: ConfirmDialog
  readonly #resizeObserver: ResizeObserver
  readonly #darkQuery: MediaQueryList
  #layout: Layout | null = null
  #frame = 0
  #pointerId: number | null = null
  #active = true

  constructor(root: ShadowRoot, options: WidgetOptions) {
    const { puzzle } = options
    this.#state = new PlayerState(puzzle, options.solution, options.store?.initial)
    this.#store = options.store

    this.#canvas = h('canvas', {
      role: 'img',
      'aria-label': `${puzzle.size.width}x${puzzle.size.height} のノノグラム`,
    })
    this.#ctx = this.#canvas.getContext('2d') as CanvasRenderingContext2D
    this.#canvasArea = h('div', { class: 'canvas-area' }, [this.#canvas])
    this.#status = h('p', { class: 'status', hidden: '' })
    this.#live = h('div', { class: 'sr-only', 'aria-live': 'polite' })

    const toolGroup = h('div', { class: 'group', role: 'group', 'aria-label': 'ツール' })
    for (const tool of availableTools(puzzle.palette, 'player')) {
      const button = toolButton(tool, puzzle)
      button.addEventListener('click', () => this.#state.setTool(tool))
      this.#toolButtons.push({ tool, button })
      toolGroup.append(button)
    }
    this.#undoButton = button(
      t.toolbar.undo,
      () => this.#state.undo(),
      t.toolbar.undoLabel,
      'symbol',
    )
    this.#redoButton = button(
      t.toolbar.redo,
      () => this.#state.redo(),
      t.toolbar.redoLabel,
      'symbol',
    )
    this.#gridButton = button(t.toolbar.gridLines, () => this.#state.toggleGridLines())
    this.#gridButton.setAttribute('aria-label', t.toolbar.gridLinesLabel)
    const resetButton = button(t.toolbar.reset, () => void this.#confirmReset())
    this.#giveUpButton = button(t.toolbar.giveUp, () => void this.#confirmGiveUp())

    this.#dialog = new ConfirmDialog()
    const widget = h(
      'div',
      { class: 'widget', style: `aspect-ratio: ${options.aspectRatio.replace(':', ' / ')};` },
      [
        this.#canvasArea,
        this.#status,
        h('div', { class: 'toolbar' }, [
          h('div', { class: 'group' }, [
            toolGroup,
            h('div', { class: 'group' }, [this.#undoButton, this.#redoButton]),
          ]),
          h('div', { class: 'group' }, [this.#gridButton, resetButton, this.#giveUpButton]),
        ]),
        this.#live,
        this.#dialog.element,
      ],
    )
    root.replaceChildren(style(), widget)

    this.#bindPointer()
    this.#state.subscribe((change) => this.#onChange(change))
    this.#resizeObserver = new ResizeObserver(() => this.#relayout())
    this.#resizeObserver.observe(this.#canvasArea)
    this.#darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
    this.#darkQuery.addEventListener('change', this.#scheduleDraw)
    this.#updateControls()
  }

  /** 埋め込み要素がページから取り除かれたとき。監視を止める。 */
  suspend(): void {
    if (!this.#active) return
    this.#active = false
    this.#resizeObserver.disconnect()
    this.#darkQuery.removeEventListener('change', this.#scheduleDraw)
    cancelAnimationFrame(this.#frame)
  }

  /** 取り除かれた埋め込み要素がページに戻ったとき。 */
  resume(): void {
    if (this.#active) return
    this.#active = true
    this.#resizeObserver.observe(this.#canvasArea)
    this.#darkQuery.addEventListener('change', this.#scheduleDraw)
  }

  #onChange(change: Change): void {
    if (change.commit) this.#store?.save(this.#state.progress)
    if (change.solved) this.#announce(t.announce.solved)
    else if (change.reset) this.#announce(t.announce.reset)
    else if (change.revealed && this.#state.revealed) this.#announce(t.announce.revealed)
    this.#updateControls()
    this.#scheduleDraw()
  }

  #announce(message: string): void {
    // 同じ文言でも読み上げられるよう、一度空にしてから入れる
    this.#live.textContent = ''
    requestAnimationFrame(() => (this.#live.textContent = message))
  }

  #updateControls(): void {
    const state = this.#state
    for (const { tool, button } of this.#toolButtons) {
      button.setAttribute('aria-pressed', String(sameTool(tool, state.tool)))
      button.disabled = state.locked
    }
    this.#undoButton.disabled = !state.canUndo
    this.#redoButton.disabled = !state.canRedo
    this.#giveUpButton.disabled = state.locked
    this.#gridButton.setAttribute('aria-pressed', String(state.showGridLines))
    const status = state.revealed ? t.status.revealed : state.solved ? t.status.solved : ''
    this.#status.textContent = status
    this.#status.hidden = status === ''
  }

  async #confirmReset(): Promise<void> {
    if (await this.#dialog.confirm(t.dialog.reset)) this.#state.reset()
  }

  async #confirmGiveUp(): Promise<void> {
    if (await this.#dialog.confirm(t.dialog.giveUp)) this.#state.giveUp()
  }

  #bindPointer(): void {
    const canvas = this.#canvas
    const position = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    canvas.addEventListener('pointerdown', (e) => {
      if (this.#pointerId !== null || !this.#layout) return
      if (e.button !== 0 && e.button !== 2) return
      const { x, y } = position(e)
      const cell = cellAt(this.#layout, this.#state.puzzle, x, y)
      if (!cell) return
      e.preventDefault()
      const operation: Operation =
        e.button === 2 || e.altKey || e.ctrlKey || e.shiftKey ? 'secondary' : 'primary'
      this.#pointerId = e.pointerId
      canvas.setPointerCapture(e.pointerId)
      this.#state.beginStroke(cell, operation)
    })
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.#pointerId || !this.#layout) return
      const { x, y } = position(e)
      this.#state.strokeTo(cellAtUnclamped(this.#layout, x, y))
    })
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.#pointerId) return
      this.#pointerId = null
      this.#state.endStroke()
    }
    canvas.addEventListener('pointerup', end)
    canvas.addEventListener('pointercancel', end)
    canvas.addEventListener('lostpointercapture', end)
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  #relayout(): void {
    const area = this.#canvasArea
    // スクロールバーの分を除いた大きさ
    const available = { width: area.clientWidth, height: area.clientHeight }
    if (available.width <= 0 || available.height <= 0) return
    this.#layout = computeLayout(this.#state.puzzle, available)
    this.#scheduleDraw()
  }

  readonly #scheduleDraw = () => {
    if (!this.#active) return
    cancelAnimationFrame(this.#frame)
    this.#frame = requestAnimationFrame(() => this.#draw())
  }

  #draw(): void {
    const layout = this.#layout
    if (!layout) return
    const dpr = window.devicePixelRatio || 1
    resizeCanvas(this.#canvas, layout, dpr)
    const state = this.#state
    draw(
      this.#ctx,
      layout,
      {
        puzzle: state.puzzle,
        board: state.displayBoard,
        satisfaction: state.satisfaction,
        solved: state.solved && !state.revealed,
        showGridLines: state.showGridLines,
        theme: this.#darkQuery.matches ? darkTheme : lightTheme,
      },
      dpr,
    )
  }
}

/** ギブアップ・リセットの確認。パズルの上に重ねて出す(confirm() は使わない)。 */
class ConfirmDialog {
  readonly element: HTMLElement
  readonly #dialog: HTMLDialogElement
  readonly #message: HTMLElement
  readonly #cancel: HTMLButtonElement
  readonly #ok: HTMLButtonElement
  #resolve: ((ok: boolean) => void) | null = null
  #returnFocus: HTMLElement | null = null

  constructor() {
    this.#message = h('p', { id: 'confirm-message' })
    this.#cancel = h('button', { type: 'button' })
    this.#ok = h('button', { type: 'button', class: 'primary' })
    this.#dialog = h('dialog', { 'aria-labelledby': 'confirm-message' }, [
      this.#message,
      h('div', { class: 'actions' }, [this.#cancel, this.#ok]),
    ])
    this.element = h('div', { class: 'overlay', hidden: '' }, [this.#dialog])
    this.#cancel.addEventListener('click', () => this.#close(false))
    this.#ok.addEventListener('click', () => this.#close(true))
    this.element.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        this.#close(false)
      }
    })
    this.#dialog.addEventListener('cancel', (e) => {
      e.preventDefault()
      this.#close(false)
    })
  }

  confirm(text: { message: string; confirm: string; cancel: string }): Promise<boolean> {
    this.#close(false)
    this.#message.textContent = text.message
    this.#cancel.textContent = text.cancel
    this.#ok.textContent = text.confirm
    const active = (this.element.getRootNode() as ShadowRoot).activeElement
    this.#returnFocus = active instanceof HTMLElement ? active : null
    this.element.hidden = false
    this.#dialog.show()
    // 初期フォーカスは取り消しボタン
    this.#cancel.focus()
    return new Promise((resolve) => (this.#resolve = resolve))
  }

  #close(ok: boolean): void {
    const resolve = this.#resolve
    if (!resolve) return
    this.#resolve = null
    this.#dialog.close()
    this.element.hidden = true
    this.#returnFocus?.focus()
    resolve(ok)
  }
}

function toolButton(tool: Tool, puzzle: Puzzle): HTMLButtonElement {
  switch (tool.kind) {
    case 'paint': {
      const color = puzzle.palette[tool.paletteIndex] ?? '#000'
      const swatch = h('span', {
        class: 'swatch',
        'aria-hidden': 'true',
        style: `background: ${color};`,
      })
      if (isMonochrome(puzzle.palette)) {
        return h('button', { type: 'button' }, [swatch, t.toolbar.paint])
      }
      return h(
        'button',
        { type: 'button', 'aria-label': t.toolbar.paintColor(displayNumber(tool.paletteIndex)) },
        [swatch],
      )
    }
    case 'cross':
      return h('button', { type: 'button', class: 'symbol', 'aria-label': t.toolbar.crossLabel }, [
        t.toolbar.cross,
      ])
    case 'erase':
      return h('button', { type: 'button' }, [t.toolbar.erase])
  }
}

function button(
  label: string,
  onClick: () => void,
  ariaLabel?: string,
  className?: string,
): HTMLButtonElement {
  const attrs: Record<string, string> = { type: 'button' }
  if (ariaLabel) attrs['aria-label'] = ariaLabel
  if (className) attrs.class = className
  const el = h('button', attrs, [label])
  el.addEventListener('click', onClick)
  return el
}

function sameTool(a: Tool, b: Tool): boolean {
  return (
    a.kind === b.kind &&
    (a.kind !== 'paint' || b.kind !== 'paint' || a.paletteIndex === b.paletteIndex)
  )
}

function style(): HTMLStyleElement {
  return h('style', {}, [css])
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value)
  el.append(...children)
  return el
}
