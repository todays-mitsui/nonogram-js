import { useSignal } from '@preact/signals'
import type { Editor } from '../store'
import { ConfirmHost } from './Confirm'
import { TestPlayDialog, WorksDialog } from './Dialogs'
import { EditorCanvas } from './EditorCanvas'
import { ExportPanel, ImportPanel, PalettePanel, SizePanel } from './Panels'
import { Toolbar } from './Toolbar'
import { UniquenessPanel } from './Uniqueness'

export function App({ editor }: { editor: Editor }) {
  const worksOpen = useSignal(false)
  const testPlayOpen = useSignal(false)
  const work = editor.work.value
  const notice = editor.notice.value

  return (
    <>
      <header class="app-header">
        <h1>ノノグラム エディタ</h1>
        {work && (
          <label class="work-title">
            <span class="sr-only">作品名</span>
            <input
              type="text"
              value={work.name}
              onChange={(e) => editor.rename(work.id, e.currentTarget.value)}
            />
          </label>
        )}
        {editor.store.available ? (
          <button type="button" onClick={() => (worksOpen.value = true)}>
            作品の一覧
          </button>
        ) : (
          <p class="hint">
            この環境では作品を保存できません。URL をブックマークすると作業を再開できます。
          </p>
        )}
        <a class="demo-link" href="./demo/">
          遊ぶ画面の見本
        </a>
      </header>
      {notice && (
        <div class="notice" role="alert">
          <p>{notice}</p>
          <button type="button" onClick={() => (editor.notice.value = null)}>
            閉じる
          </button>
        </div>
      )}
      <main class="workspace">
        <div class="canvas-panel">
          <EditorCanvas editor={editor} />
          <Toolbar editor={editor} />
        </div>
        <aside class="sidebar">
          <SizePanel editor={editor} />
          <PalettePanel editor={editor} />
          <UniquenessPanel editor={editor} />
          <ExportPanel editor={editor} onTestPlay={() => (testPlayOpen.value = true)} />
          <ImportPanel editor={editor} />
        </aside>
      </main>
      <WorksDialog
        editor={editor}
        open={worksOpen.value}
        onClose={() => (worksOpen.value = false)}
      />
      <TestPlayDialog
        editor={editor}
        open={testPlayOpen.value}
        onClose={() => (testPlayOpen.value = false)}
      />
      <ConfirmHost />
    </>
  )
}
