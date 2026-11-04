import { displayNumber } from '../../core/palette'
import { availableTools, type Tool } from '../../core/tool'
import { player as t } from '../../i18n/ja'
import { clear } from '../commands'
import type { Editor } from '../store'
import { confirmAction } from './Confirm'

const same = (a: Tool, b: Tool) =>
  a.kind === b.kind &&
  (a.kind !== 'paint' || b.kind !== 'paint' || a.paletteIndex === b.paletteIndex)

export function Toolbar({ editor }: { editor: Editor }) {
  const { palette } = editor.doc.value
  const active = editor.tool.value
  return (
    <div class="toolbar">
      <div class="group" role="group" aria-label="ツール">
        {availableTools(palette, 'editor').map((tool) => {
          const pressed = same(tool, active)
          if (tool.kind === 'paint') {
            return (
              <button
                type="button"
                aria-pressed={pressed}
                aria-label={t.toolbar.paintColor(displayNumber(tool.paletteIndex))}
                title={`色${displayNumber(tool.paletteIndex)}`}
                onClick={() => (editor.tool.value = tool)}
              >
                <span class="swatch" style={{ background: palette[tool.paletteIndex] }} />
                {palette.length === 1 && t.toolbar.paint}
              </button>
            )
          }
          return (
            <button type="button" aria-pressed={pressed} onClick={() => (editor.tool.value = tool)}>
              {t.toolbar.erase}
            </button>
          )
        })}
      </div>
      <div class="group">
        <button
          type="button"
          class="symbol"
          aria-label={t.toolbar.undoLabel}
          disabled={!editor.canUndo.value}
          onClick={() => editor.history.undo()}
        >
          {t.toolbar.undo}
        </button>
        <button
          type="button"
          class="symbol"
          aria-label={t.toolbar.redoLabel}
          disabled={!editor.canRedo.value}
          onClick={() => editor.history.redo()}
        >
          {t.toolbar.redo}
        </button>
        <button
          type="button"
          onClick={async () => {
            if (await confirmAction('全部のマスを消しますか? 枠外のマスも消えます。', '全部消す')) {
              editor.apply(clear)
            }
          }}
        >
          全部消す
        </button>
      </div>
    </div>
  )
}
