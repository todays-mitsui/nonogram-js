import { useSignal } from '@preact/signals'
import { useEffect, useRef } from 'preact/hooks'
import { BLANK, type Mark } from '../../core/board'
import { derivePuzzle } from '../../core/clue'
import type { Grid } from '../../core/grid'
import { EMPTY, visibleGrid, type SolutionCell } from '../../core/solution'
import { editor as t } from '../../i18n/ja'
import { draw, resizeCanvas } from '../../render/draw'
import { computeLayout } from '../../render/layout'
import { lightTheme } from '../../render/theme'
import type { Editor } from '../store'

export function UniquenessPanel({ editor }: { editor: Editor }) {
  const state = editor.uniqueness.value
  const showAlternative = useSignal(false)
  let message: string
  let tone: 'ok' | 'warn' | 'muted' = 'muted'
  if (state.status === 'checking') {
    message = '判定しています…'
  } else if (state.status === 'error') {
    message = '判定できませんでした'
    tone = 'warn'
  } else {
    const kind = state.result.kind
    message =
      kind === 'line-solvable'
        ? t.uniqueness.lineSolvable
        : kind === 'needs-guessing'
          ? t.uniqueness.needsGuessing
          : kind === 'multiple'
            ? t.uniqueness.multipleSolutions
            : t.uniqueness.timedOut
    tone = kind === 'line-solvable' ? 'ok' : kind === 'needs-guessing' ? 'muted' : 'warn'
  }
  const alternative =
    state.status === 'done' && state.result.kind === 'multiple' ? state.result.alternative : null

  return (
    <section class="panel" aria-labelledby="uniqueness-heading">
      <h2 id="uniqueness-heading">一意解チェック</h2>
      <p class={`uniqueness ${tone}`} role="status">
        {message}
      </p>
      {alternative && (
        <button type="button" onClick={() => (showAlternative.value = !showAlternative.value)}>
          {showAlternative.value ? '別の答えを隠す' : '別の答えを見る'}
        </button>
      )}
      {alternative && showAlternative.value && <Alternative editor={editor} grid={alternative} />}
      <p class="hint">ヒントだけから解けるかを調べます。書き出しは止めません。</p>
    </section>
  )
}

/** 別解を描き、作問者の正解図と違うマスを枠で示す。 */
function Alternative({ editor, grid }: { editor: Editor; grid: Grid<SolutionCell> }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const doc = editor.doc.value
  const authored = visibleGrid(doc.solution)
  const differing = grid.toCells().filter((c, i) => c !== authored.toCells()[i]).length

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const puzzle = derivePuzzle(doc.solution, doc.palette)
    const width = canvas.parentElement?.clientWidth ?? 280
    const layout = computeLayout(puzzle, { width, height: width })
    const dpr = window.devicePixelRatio || 1
    resizeCanvas(canvas, layout, dpr)
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    draw(
      ctx,
      layout,
      {
        puzzle,
        board: grid.map((c): Mark => (c === EMPTY ? BLANK : c)),
        satisfaction: {
          rows: puzzle.rowClues.map(() => false),
          columns: puzzle.columnClues.map(() => false),
        },
        solved: false,
        showGridLines: true,
        theme: lightTheme,
      },
      dpr,
    )
    const s = layout.cellSize
    ctx.strokeStyle = '#E0A526'
    ctx.lineWidth = 3
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (grid.get(x, y) !== authored.get(x, y)) {
          ctx.strokeRect(
            layout.cellAreaX + x * s + 1.5,
            layout.cellAreaY + y * s + 1.5,
            s - 3,
            s - 3,
          )
        }
      }
    }
  }, [grid, doc])

  return (
    <div class="alternative">
      <p class="hint">
        同じヒントで、この絵も答えになります。黄色の枠の {differing} マスが違います。
      </p>
      <canvas ref={ref} role="img" aria-label={`別の答え。${differing} マスが違う`} />
    </div>
  )
}
