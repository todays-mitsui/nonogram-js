import { useEffect, useRef } from 'preact/hooks'
import { derivePuzzle } from '../../core/clue'
import { crop, visibleGrid } from '../../core/solution'
import { editor as t } from '../../i18n/ja'
import { Widget } from '../../player/widget'
import type { Editor } from '../store'
import { confirmAction } from './Confirm'

/** モーダルの <dialog>。open が false になったら閉じる。 */
function useModal(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return ref
}

/** テストプレイ: 同じ画面でプレイモードを開く。進捗は保存しない。 */
export function TestPlayDialog({
  editor,
  open,
  onClose,
}: {
  editor: Editor
  open: boolean
  onClose: () => void
}) {
  const ref = useModal(open)
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = hostRef.current
    if (!open || !container) return
    // Shadow DOM は1つの要素に1回しか付けられないので、開くたびに新しい要素を作る
    const host = document.createElement('div')
    container.replaceChildren(host)
    const { solution, palette } = editor.doc.value
    const widget = new Widget(host.attachShadow({ mode: 'open' }), {
      puzzle: derivePuzzle(solution, palette),
      solution: visibleGrid(crop(solution)),
      aspectRatio: editor.aspectRatio.value,
      store: null,
    })
    return () => {
      widget.suspend()
      container.replaceChildren()
    }
  }, [open])

  return (
    <dialog ref={ref} class="testplay" aria-labelledby="testplay-heading" onClose={onClose}>
      <div class="dialog-header">
        <h2 id="testplay-heading">テストプレイ</h2>
        <button type="button" onClick={onClose}>
          閉じる
        </button>
      </div>
      <p class="hint">進捗は保存しません。</p>
      <div ref={hostRef} class="testplay-host" />
    </dialog>
  )
}

export function WorksDialog({
  editor,
  open,
  onClose,
}: {
  editor: Editor
  open: boolean
  onClose: () => void
}) {
  const ref = useModal(open)
  const current = editor.work.value
  const format = (iso: string) =>
    new Date(iso).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' })

  return (
    <dialog ref={ref} class="works" aria-labelledby="works-heading" onClose={onClose}>
      <div class="dialog-header">
        <h2 id="works-heading">作品の一覧</h2>
        <button type="button" onClick={onClose}>
          閉じる
        </button>
      </div>
      <button
        type="button"
        class="primary"
        onClick={async () => {
          await editor.createWork()
          onClose()
        }}
      >
        新しい作品
      </button>
      <ul class="work-list">
        {editor.works.value.map((w) => (
          <li key={w.id} aria-current={w.id === current?.id ? 'true' : undefined}>
            <div class="work-name">
              <strong>{w.name}</strong>
              <span class="hint">更新 {format(w.updatedAt)}</span>
            </div>
            <div class="row-actions">
              <button
                type="button"
                disabled={w.id === current?.id}
                onClick={async () => {
                  await editor.openWork(w.id)
                  onClose()
                }}
              >
                開く
              </button>
              <button type="button" onClick={() => void editor.duplicate(w.id)}>
                複製
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (await confirmAction(t.confirm.deleteWork(w.name), '削除する')) {
                    await editor.remove(w.id)
                  }
                }}
              >
                削除
              </button>
            </div>
          </li>
        ))}
      </ul>
    </dialog>
  )
}
