import { describe, expect, it } from 'vitest'
import { encodeCells } from '../core/cells-codec'
import { visibleGrid } from '../core/solution'
import { newDoc, paintCells, setSize } from './commands'
import { exportEmbedTag, extractCode, fromHash, importText, toHash } from './exchange'
import { defaultName, WorkStore } from './works'

class MemoryStorage implements Storage {
  #map = new Map<string, string>()
  get length() {
    return this.#map.size
  }
  clear() {
    this.#map.clear()
  }
  getItem(key: string) {
    return this.#map.get(key) ?? null
  }
  key(index: number) {
    return [...this.#map.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.#map.delete(key)
  }
  setItem(key: string, value: string) {
    this.#map.set(key, value)
  }
}

function setup() {
  let clock = Date.UTC(2026, 10, 4, 7, 0)
  let n = 0
  const storage = new MemoryStorage()
  const store = new WorkStore(storage, {
    now: () => new Date((clock += 60_000)),
    newId: () => `id${++n}`,
  })
  return { store, storage }
}

describe('WorkStore', () => {
  it('作品を作って開ける。キーは README §5.4 のとおり', async () => {
    const { store, storage } = setup()
    const doc = paintCells(newDoc(), [{ x: 1, y: 2 }], 0)
    const meta = await store.create(doc)
    expect(meta.name.startsWith('無題 ')).toBe(true)
    expect(storage.getItem('todays-mitsui/nonogram:editor:works')).toContain('"id1"')
    expect(storage.getItem('todays-mitsui/nonogram:editor:work:id1')).toMatch(/^v2;15x15;/)
    const loaded = await store.load(meta.id)
    expect(loaded && visibleGrid(loaded.solution).get(1, 2)).toBe(0)
  })

  it('作問側の保存なので枠外のマスも残る', async () => {
    const { store } = setup()
    const doc = setSize(paintCells(newDoc(), [{ x: 14, y: 0 }], 0), 5, 5)
    const meta = await store.create(doc)
    const loaded = await store.load(meta.id)
    expect(loaded?.solution.grid.get(14, 0)).toBe(0)
  })

  it('一覧は更新の新しい順、最後に開いた作品を覚える', async () => {
    const { store } = setup()
    const a = await store.create(newDoc(), 'a')
    const b = await store.create(newDoc(), 'b')
    expect(store.list().map((w) => w.name)).toEqual(['b', 'a'])
    store.markOpened(a.id)
    expect(store.lastOpened()?.id).toBe(a.id)
    await store.save(a.id, newDoc())
    expect(store.list()[0]?.id).toBe(a.id)
    expect(b.id).toBe('id2')
  })

  it('名前の変更・複製・削除', async () => {
    const { store, storage } = setup()
    const a = await store.create(newDoc(), 'a')
    store.rename(a.id, 'ハート')
    store.setAspectRatio(a.id, '3:4')
    const copy = await store.duplicate(a.id)
    expect(copy).toMatchObject({ name: 'ハート のコピー', aspectRatio: '3:4' })
    store.delete(a.id)
    expect(store.list().map((w) => w.id)).toEqual([copy?.id])
    expect(storage.getItem(`todays-mitsui/nonogram:editor:work:${a.id}`)).toBeNull()
  })

  it('同じ正解図コードの作品を探せる', async () => {
    const { store, storage } = setup()
    const a = await store.create(newDoc())
    const code = storage.getItem(`todays-mitsui/nonogram:editor:work:${a.id}`) as string
    expect(store.findByCode(code)?.id).toBe(a.id)
    expect(store.findByCode('v2;nope')).toBeNull()
  })

  it('localStorage がなければ一覧なしで動く', async () => {
    const store = new WorkStore(null)
    expect(store.available).toBe(false)
    const meta = await store.create(newDoc())
    expect(store.list()).toEqual([])
    expect(await store.load(meta.id)).toBeNull()
  })

  it('壊れた一覧は空として扱う', () => {
    const { store, storage } = setup()
    storage.setItem('todays-mitsui/nonogram:editor:works', '{broken')
    expect(store.list()).toEqual([])
  })

  it('名前の初期値', () => {
    expect(defaultName(new Date(2026, 10, 4, 9, 5))).toBe('無題 2026/11/04 09:05')
  })
})

describe('書き出しと読み込み', () => {
  it('埋め込みタグは切り抜いたコードと縦横比を持つ', async () => {
    const doc = setSize(paintCells(newDoc(), [{ x: 14, y: 0 }], 0), 5, 5)
    const tag = await exportEmbedTag(doc, '3:4')
    expect(tag).toMatch(
      /^<div class="todays-mitsui__nonogram" data-solution="v2;5x5;5x5;#000;[^"]+" data-aspect-ratio="3:4">/,
    )
    expect(tag).toContain(
      '<script src="https://todays-mitsui.github.io/nonogram-js/player/v1/player.js" defer></script>',
    )
  })

  it('埋め込みタグからも正解図コードからも読み込める', async () => {
    const tag = await exportEmbedTag(newDoc(), '1:1')
    const code = extractCode(tag)
    expect(code).toMatch(/^v2;15x15;15x15;#000;/)
    expect((await importText(tag)).ok).toBe(true)
    expect((await importText(`  ${code}\n`)).ok).toBe(true)
  })

  it('17 色以上は読み込まない', async () => {
    const palette = Array.from({ length: 17 }, () => '#000').join(';')
    const cells = await encodeCells(Uint8Array.from([1]))
    const result = await importText(`v2;1x1;1x1;${palette};${cells}`)
    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining('17 色あるため'),
    })
  })

  it('不正なコードは理由を返す', async () => {
    const result = await importText('v1;5x5;5x5;#000;AAAA')
    expect(result).toEqual({ ok: false, message: expect.stringContaining('v1') })
  })

  it('URL の # は # を含むコードをエンコードする', () => {
    const code = 'v2;5x5;5x5;#000;Y2BkAEI4ADEZGIBCDAA'
    expect(toHash(code)).not.toContain('#000')
    expect(fromHash(toHash(code))).toBe(code)
    expect(fromHash(`#${code}`)).toBe(code)
    expect(fromHash('')).toBeNull()
  })
})
