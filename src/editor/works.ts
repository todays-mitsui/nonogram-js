/**
 * 作品の保存(README §5.4)。
 *
 * - `todays-mitsui/nonogram:editor:works`: 作品の一覧(JSON)
 * - `todays-mitsui/nonogram:editor:work:<id>`: 作品の中身(作問側の保存の正解図コード)
 *
 * localStorage が使えない環境では null の Storage を渡し、一覧なしで動く(保存しない)。
 */

import { STORAGE_PREFIX } from '../core/progress'
import type { AspectRatio } from '../player/widget'
import type { EditorDoc } from './commands'
import { encodeDoc, importText } from './exchange'

export interface WorkMeta {
  readonly id: string
  readonly name: string
  /** ISO 8601。中身を保存した日時。 */
  readonly updatedAt: string
  /** ISO 8601。最後に開いた日時。`#` なしで開いたときに開く作品を決める。 */
  readonly openedAt: string
  /** 書き出しで最後に選んだ縦横比。 */
  readonly aspectRatio: AspectRatio
}

const INDEX_KEY = `${STORAGE_PREFIX}editor:works`
const workKey = (id: string) => `${STORAGE_PREFIX}editor:work:${id}`

export class WorkStore {
  readonly #storage: Storage | null
  readonly #now: () => Date
  readonly #newId: () => string

  constructor(storage: Storage | null, options: { now?: () => Date; newId?: () => string } = {}) {
    this.#storage = storage
    this.#now = options.now ?? (() => new Date())
    this.#newId = options.newId ?? (() => crypto.randomUUID())
  }

  get available(): boolean {
    return this.#storage !== null
  }

  /** 更新日時の新しい順。 */
  list(): WorkMeta[] {
    return [...this.#readIndex()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  get(id: string): WorkMeta | null {
    return this.#readIndex().find((w) => w.id === id) ?? null
  }

  /** 最後に開いた作品。 */
  lastOpened(): WorkMeta | null {
    return [...this.#readIndex()].sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0] ?? null
  }

  async create(doc: EditorDoc, name?: string): Promise<WorkMeta> {
    const now = this.#now()
    const meta: WorkMeta = {
      id: this.#newId(),
      name: name ?? defaultName(now),
      updatedAt: now.toISOString(),
      openedAt: now.toISOString(),
      aspectRatio: '1:1',
    }
    this.#writeIndex([...this.#readIndex(), meta])
    await this.save(meta.id, doc)
    return meta
  }

  async load(id: string): Promise<EditorDoc | null> {
    const code = this.#get(workKey(id))
    if (code === null) return null
    const result = await importText(code)
    return result.ok ? result.doc : null
  }

  async save(id: string, doc: EditorDoc): Promise<void> {
    this.#set(workKey(id), await encodeDoc(doc))
    this.#update(id, { updatedAt: this.#now().toISOString() })
  }

  /** 同じ正解図コードの作品を探す(共有された URL を開いたとき、既存の作品を上書きしないため)。 */
  findByCode(code: string): WorkMeta | null {
    return this.#readIndex().find((w) => this.#get(workKey(w.id)) === code) ?? null
  }

  markOpened(id: string): void {
    this.#update(id, { openedAt: this.#now().toISOString() })
  }

  rename(id: string, name: string): void {
    this.#update(id, { name })
  }

  setAspectRatio(id: string, aspectRatio: AspectRatio): void {
    this.#update(id, { aspectRatio })
  }

  async duplicate(id: string): Promise<WorkMeta | null> {
    const source = this.get(id)
    const doc = await this.load(id)
    if (!source || !doc) return null
    const copy = await this.create(doc, `${source.name} のコピー`)
    this.setAspectRatio(copy.id, source.aspectRatio)
    return this.get(copy.id)
  }

  delete(id: string): void {
    this.#writeIndex(this.#readIndex().filter((w) => w.id !== id))
    try {
      this.#storage?.removeItem(workKey(id))
    } catch {
      // 消せなくても一覧からは消えている
    }
  }

  #update(id: string, patch: Partial<WorkMeta>): void {
    this.#writeIndex(this.#readIndex().map((w) => (w.id === id ? { ...w, ...patch } : w)))
  }

  #readIndex(): WorkMeta[] {
    const json = this.#get(INDEX_KEY)
    if (!json) return []
    try {
      const parsed: unknown = JSON.parse(json)
      return Array.isArray(parsed) ? parsed.filter(isWorkMeta) : []
    } catch {
      return []
    }
  }

  #writeIndex(works: readonly WorkMeta[]): void {
    this.#set(INDEX_KEY, JSON.stringify(works))
  }

  #get(key: string): string | null {
    try {
      return this.#storage?.getItem(key) ?? null
    } catch {
      return null
    }
  }

  #set(key: string, value: string): void {
    try {
      this.#storage?.setItem(key, value)
    } catch {
      // 容量不足などで保存できなくても、URL の # で作業は保たれる
    }
  }
}

/** 名前の初期値「無題 {作成日時}」。 */
export function defaultName(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `無題 ${date.getFullYear()}/${p(date.getMonth() + 1)}/${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`
}

function isWorkMeta(value: unknown): value is WorkMeta {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.updatedAt === 'string' &&
    typeof v.openedAt === 'string' &&
    (v.aspectRatio === '3:4' || v.aspectRatio === '1:1' || v.aspectRatio === '4:3')
  )
}

/** ブラウザの localStorage。使えなければ null。 */
export function browserStorage(): Storage | null {
  try {
    const storage = window.localStorage
    const probe = `${STORAGE_PREFIX}probe`
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return storage
  } catch {
    return null
  }
}
