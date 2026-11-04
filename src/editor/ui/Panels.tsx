import { useSignal } from '@preact/signals'
import { useEffect, useState } from 'preact/hooks'
import { displayNumber } from '../../core/palette'
import { editor as t } from '../../i18n/ja'
import type { AspectRatio } from '../../player/widget'
import {
  addColor,
  countCells,
  MAX_COLORS,
  MAX_SIZE,
  MIN_SIZE,
  moveColor,
  removeColor,
  setSize,
  updateColor,
} from '../commands'
import { exportEmbedTag } from '../exchange'
import type { Editor } from '../store'
import { confirmAction } from './Confirm'

/** 色を足すときに順に提案する色。 */
const SUGGESTED = [
  '#D23F31',
  '#2563C9',
  '#3C8D2F',
  '#E0A526',
  '#7A4B24',
  '#8E44AD',
  '#F28AB2',
  '#6B7280',
]

export function SizePanel({ editor }: { editor: Editor }) {
  const { frame } = editor.doc.value.solution
  const [width, setWidth] = useState(String(frame.width))
  const [height, setHeight] = useState(String(frame.height))
  useEffect(() => {
    setWidth(String(frame.width))
    setHeight(String(frame.height))
  }, [frame.width, frame.height])

  return (
    <section class="panel" aria-labelledby="size-heading">
      <h2 id="size-heading">サイズ</h2>
      <form
        class="size-form"
        onSubmit={(e) => {
          e.preventDefault()
          editor.apply((d) => setSize(d, Number(width), Number(height)))
        }}
      >
        <label>
          幅
          <input
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            required
            value={width}
            onInput={(e) => setWidth(e.currentTarget.value)}
          />
        </label>
        <span aria-hidden="true">×</span>
        <label>
          高さ
          <input
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            required
            value={height}
            onInput={(e) => setHeight(e.currentTarget.value)}
          />
        </label>
        <button type="submit">変更</button>
      </form>
      <p class="hint">
        {MIN_SIZE}〜{MAX_SIZE}。縮めても枠外のマスは消えません。
      </p>
    </section>
  )
}

export function PalettePanel({ editor }: { editor: Editor }) {
  const doc = editor.doc.value
  const { palette } = doc
  return (
    <section class="panel" aria-labelledby="palette-heading">
      <h2 id="palette-heading">パレット</h2>
      <ol class="palette">
        {palette.map((color, i) => (
          <li key={i}>
            <label class="color-field">
              <span class="label">色{displayNumber(i)}</span>
              <input
                type="color"
                value={toLongHex(color)}
                onChange={(e) => editor.apply((d) => updateColor(d, i, e.currentTarget.value))}
              />
              <code>{color}</code>
            </label>
            <div class="row-actions">
              <button
                type="button"
                class="symbol"
                aria-label={`色${displayNumber(i)}を上へ`}
                disabled={i === 0}
                onClick={() => editor.apply((d) => moveColor(d, i, i - 1))}
              >
                ↑
              </button>
              <button
                type="button"
                class="symbol"
                aria-label={`色${displayNumber(i)}を下へ`}
                disabled={i === palette.length - 1}
                onClick={() => editor.apply((d) => moveColor(d, i, i + 1))}
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`色${displayNumber(i)}を削除`}
                disabled={palette.length <= 1}
                onClick={async () => {
                  const used = countCells(editor.doc.value, i)
                  if (
                    used === 0 ||
                    (await confirmAction(
                      t.confirm.removeUsedColor(displayNumber(i), used),
                      '削除する',
                    ))
                  ) {
                    editor.apply((d) => removeColor(d, i))
                  }
                }}
              >
                削除
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={palette.length >= MAX_COLORS}
        onClick={() =>
          editor.apply((d) => addColor(d, SUGGESTED[(d.palette.length - 1) % SUGGESTED.length]!))
        }
      >
        色を追加
      </button>
      <p class="hint">{MAX_COLORS} 色まで。色の値を変えても、解答者の進捗は消えません。</p>
    </section>
  )
}

const RATIOS: { value: AspectRatio; label: string }[] = [
  { value: '3:4', label: '縦長' },
  { value: '1:1', label: '正方形' },
  { value: '4:3', label: '横長' },
]

export function ExportPanel({ editor, onTestPlay }: { editor: Editor; onTestPlay: () => void }) {
  const tag = useSignal('')
  const copied = useSignal(false)
  const doc = editor.doc.value
  const ratio = editor.aspectRatio.value

  useEffect(() => {
    let cancelled = false
    copied.value = false
    void exportEmbedTag(doc, ratio).then((value) => {
      if (!cancelled) tag.value = value
    })
    return () => {
      cancelled = true
    }
  }, [doc, ratio])

  return (
    <section class="panel" aria-labelledby="export-heading">
      <h2 id="export-heading">書き出し</h2>
      <fieldset class="ratios">
        <legend>縦横比</legend>
        {RATIOS.map((r) => (
          <label key={r.value}>
            <input
              type="radio"
              name="aspect-ratio"
              value={r.value}
              checked={ratio === r.value}
              onChange={() => editor.setAspectRatio(r.value)}
            />
            {r.label}
          </label>
        ))}
      </fieldset>
      <label class="stack">
        埋め込みタグ
        <textarea readOnly rows={5} value={tag.value} onFocus={(e) => e.currentTarget.select()} />
      </label>
      <div class="row-actions">
        <button
          type="button"
          class="primary"
          onClick={async () => {
            await navigator.clipboard.writeText(tag.value)
            copied.value = true
          }}
        >
          タグをコピー
        </button>
        <button type="button" onClick={onTestPlay}>
          テストプレイ
        </button>
      </div>
      <p class="hint" role="status">
        {copied.value ? t.export.copied : ''}
      </p>
    </section>
  )
}

export function ImportPanel({ editor }: { editor: Editor }) {
  const text = useSignal('')
  const error = useSignal<string | null>(null)
  return (
    <section class="panel" aria-labelledby="import-heading">
      <h2 id="import-heading">読み込み</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          error.value = await editor.importAsNewWork(text.value)
          if (!error.value) text.value = ''
        }}
      >
        <label class="stack">
          正解図コード、または埋め込みタグ
          <textarea
            rows={3}
            value={text.value}
            onInput={(e) => (text.value = e.currentTarget.value)}
          />
        </label>
        <button type="submit" disabled={text.value.trim() === ''}>
          新しい作品として読み込む
        </button>
      </form>
      {error.value && (
        <p class="error-text" role="alert">
          {error.value}
        </p>
      )}
    </section>
  )
}

/** <input type="color"> は #RRGGBB しか受け付けない。 */
function toLongHex(color: string): string {
  if (color.length === 4)
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toLowerCase()
  return color.toLowerCase()
}
