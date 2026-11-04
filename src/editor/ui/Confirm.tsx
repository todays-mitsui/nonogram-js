import { signal } from '@preact/signals'
import { useEffect, useRef } from 'preact/hooks'

interface Request {
  readonly message: string
  readonly confirmLabel: string
  readonly resolve: (ok: boolean) => void
}

const request = signal<Request | null>(null)

/** 確認ダイアログを出す。実行ボタンには何が起きるかを書く。 */
export function confirmAction(message: string, confirmLabel: string): Promise<boolean> {
  request.value?.resolve(false)
  return new Promise((resolve) => (request.value = { message, confirmLabel, resolve }))
}

export function ConfirmHost() {
  const ref = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const current = request.value

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (current && !dialog.open) {
      dialog.showModal()
      cancelRef.current?.focus()
    }
    if (!current && dialog.open) dialog.close()
  }, [current])

  const close = (ok: boolean) => {
    const r = request.value
    request.value = null
    r?.resolve(ok)
  }

  return (
    <dialog
      ref={ref}
      class="confirm"
      aria-labelledby="confirm-message"
      onCancel={(e) => {
        e.preventDefault()
        close(false)
      }}
    >
      <p id="confirm-message">{current?.message}</p>
      <div class="actions">
        <button type="button" ref={cancelRef} onClick={() => close(false)}>
          やめる
        </button>
        <button type="button" class="primary" onClick={() => close(true)}>
          {current?.confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
