import { useEffect, useRef } from 'preact/hooks'
import { BLANK, type Mark } from '../../core/board'
import { derivePuzzle } from '../../core/clue'
import { EMPTY, hasCellsOutsideFrame, visibleGrid } from '../../core/solution'
import type { Operation } from '../../core/tool'
import { draw, resizeCanvas } from '../../render/draw'
import { cellAt, cellAtUnclamped, computeLayout, type Layout } from '../../render/layout'
import { darkTheme, lightTheme } from '../../render/theme'
import type { Editor } from '../store'

/** 描いている絵と、そこから導出したヒントを、プレイモードと同じ見た目で表示する。 */
export function EditorCanvas({ editor }: { editor: Editor }) {
  const areaRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const doc = editor.doc.value

  useEffect(() => {
    const area = areaRef.current as HTMLDivElement
    const canvas = canvasRef.current as HTMLCanvasElement
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    let layout: Layout | null = null
    let frame = 0
    let pointerId: number | null = null

    const state = () => {
      const current = editor.doc.value
      const puzzle = derivePuzzle(current.solution, current.palette)
      return { current, puzzle }
    }

    const render = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const { current, puzzle } = state()
        // なぞっている間はレイアウトを固定する。ヒントの項目数が増えて盤面がずれると、
        // 指の下のマスが変わってしまうため。指を離したら計算し直す
        if (pointerId === null || !layout) {
          layout = computeLayout(puzzle, { width: area.clientWidth, height: area.clientHeight })
        }
        const dpr = window.devicePixelRatio || 1
        resizeCanvas(canvas, layout, dpr)
        const board = visibleGrid(current.solution).map((c): Mark => (c === EMPTY ? BLANK : c))
        draw(
          ctx,
          layout,
          {
            puzzle,
            board,
            satisfaction: {
              rows: puzzle.rowClues.map(() => false),
              columns: puzzle.columnClues.map(() => false),
            },
            solved: false,
            showGridLines: true,
            theme: dark.matches ? darkTheme : lightTheme,
          },
          dpr,
        )
      })
    }

    const position = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const down = (e: PointerEvent) => {
      if (pointerId !== null || !layout) return
      if (e.button !== 0 && e.button !== 2) return
      const { x, y } = position(e)
      const cell = cellAt(layout, state().puzzle, x, y)
      if (!cell) return
      e.preventDefault()
      const operation: Operation =
        e.button === 2 || e.altKey || e.ctrlKey || e.shiftKey ? 'secondary' : 'primary'
      pointerId = e.pointerId
      canvas.setPointerCapture(e.pointerId)
      editor.history.beginStroke(cell, operation, editor.tool.value)
    }
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId || !layout) return
      const { x, y } = position(e)
      editor.history.strokeTo(cellAtUnclamped(layout, x, y))
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      pointerId = null
      editor.history.endStroke()
      render()
    }
    const noMenu = (e: Event) => e.preventDefault()

    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('lostpointercapture', up)
    canvas.addEventListener('contextmenu', noMenu)
    const observer = new ResizeObserver(render)
    observer.observe(area)
    dark.addEventListener('change', render)
    const unsubscribe = editor.doc.subscribe(render)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      dark.removeEventListener('change', render)
      unsubscribe()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('lostpointercapture', up)
      canvas.removeEventListener('contextmenu', noMenu)
    }
  }, [editor])

  const { width, height } = doc.solution.frame
  return (
    <div class="canvas-column">
      <div class="canvas-area" ref={areaRef}>
        <canvas ref={canvasRef} role="img" aria-label={`${width}x${height} の正解図とヒント`} />
      </div>
      {hasCellsOutsideFrame(doc.solution) && (
        <p class="hint">
          枠外に塗ったマスがあります。サイズを広げると見えます(書き出しには含まれません)。
        </p>
      )}
    </div>
  )
}
