/**
 * エディタ画面の状態。コマンドとアンドゥは EditorHistory が持ち、ここは signal で UI に配る。
 * 作業は描くたびに localStorage と URL の # に保存する(README §5.4)。
 */

import { computed, signal } from '@preact/signals'
import { INITIAL_TOOL, type Tool } from '../core/tool'
import type { AspectRatio } from '../player/widget'
import { newDoc, type EditorDoc } from './commands'
import { encodeDoc, fromHash, importText, toHash } from './exchange'
import { EditorHistory } from './history'
import type { WorkMeta, WorkStore } from './works'

const SAVE_DELAY_MS = 300

export type Editor = ReturnType<typeof createEditor>

export function createEditor(store: WorkStore) {
  const history = new EditorHistory(newDoc())
  const doc = signal<EditorDoc>(history.doc)
  const revision = signal(0)
  const tool = signal<Tool>(INITIAL_TOOL)
  const workId = signal<string | null>(null)
  const works = signal<WorkMeta[]>(store.list())
  const notice = signal<string | null>(null)

  const work = computed(() => {
    void revision.value
    const id = workId.value
    return id ? (works.value.find((w) => w.id === id) ?? null) : null
  })
  // history は signal ではないので、revision を読んで更新を拾う
  const canUndo = computed(() => revision.value >= 0 && history.canUndo)
  const canRedo = computed(() => revision.value >= 0 && history.canRedo)
  const aspectRatio = signal<AspectRatio>('1:1')

  let saveTimer: ReturnType<typeof setTimeout> | undefined
  history.subscribe((next) => {
    doc.value = next
    revision.value++
    // パレットが減って現在のツールの色がなくなったら、色0に戻す
    const current = tool.value
    if (current.kind === 'paint' && current.paletteIndex >= next.palette.length) {
      tool.value = INITIAL_TOOL
    }
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void save(), SAVE_DELAY_MS)
  })

  async function save(): Promise<void> {
    const code = await encodeDoc(history.doc)
    window.history.replaceState(null, '', toHash(code))
    const id = workId.value
    if (id) {
      await store.save(id, history.doc)
      refreshWorks()
    }
  }

  function refreshWorks(): void {
    works.value = store.list()
  }

  async function openWork(id: string): Promise<boolean> {
    const loaded = await store.load(id)
    if (!loaded) return false
    workId.value = id
    store.markOpened(id)
    aspectRatio.value = store.get(id)?.aspectRatio ?? '1:1'
    tool.value = INITIAL_TOOL
    history.replace(loaded)
    refreshWorks()
    return true
  }

  async function createWork(initial: EditorDoc = newDoc(), name?: string): Promise<void> {
    const meta = await store.create(initial, name)
    workId.value = meta.id
    aspectRatio.value = meta.aspectRatio
    tool.value = INITIAL_TOOL
    history.replace(initial)
    refreshWorks()
  }

  /** 正解図コードか埋め込みタグを読み込み、新しい作品にする(今の作品は上書きしない)。 */
  async function importAsNewWork(text: string): Promise<string | null> {
    const result = await importText(text)
    if (!result.ok) return result.message
    const existing = store.findByCode(result.code)
    if (existing) await openWork(existing.id)
    else await createWork(result.doc)
    return null
  }

  /**
   * 開いたときに開く作品を決める。
   * `#` 付きなら、同じ正解図コードの作品を開くか新しい作品として取り込む。`#` なしなら最後に開いた作品。
   */
  async function start(): Promise<void> {
    const code = fromHash(window.location.hash)
    if (code) {
      const error = await importAsNewWork(code)
      if (!error) return
      notice.value = error
    }
    const last = store.lastOpened()
    if (last && (await openWork(last.id))) return
    await createWork()
  }

  function setAspectRatio(value: AspectRatio): void {
    aspectRatio.value = value
    const id = workId.value
    if (id) {
      store.setAspectRatio(id, value)
      refreshWorks()
    }
  }

  function rename(id: string, name: string): void {
    store.rename(id, name.trim() || '無題')
    refreshWorks()
  }

  async function duplicate(id: string): Promise<void> {
    await store.duplicate(id)
    refreshWorks()
  }

  async function remove(id: string): Promise<void> {
    store.delete(id)
    refreshWorks()
    if (workId.value === id) {
      const next = store.lastOpened()
      if (!next || !(await openWork(next.id))) await createWork()
    }
  }

  return {
    history,
    store,
    doc,
    tool,
    work,
    works,
    notice,
    canUndo,
    canRedo,
    aspectRatio,
    start,
    openWork,
    createWork,
    importAsNewWork,
    setAspectRatio,
    rename,
    duplicate,
    remove,
    /** コマンドを適用する。不正ならメッセージを notice に出す。 */
    apply(command: (doc: EditorDoc) => EditorDoc): boolean {
      try {
        history.apply(command)
        return true
      } catch (error) {
        notice.value = error instanceof Error ? error.message : String(error)
        return false
      }
    },
  }
}
