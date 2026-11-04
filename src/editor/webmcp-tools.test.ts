import { describe, expect, it } from 'vitest'
import { newDoc, type EditorDoc } from './commands'
import { EditorHistory } from './history'
import { createTools, type EditorApi } from './webmcp-tools'

function setup() {
  const history = new EditorHistory(newDoc())
  const imported: string[] = []
  const api: EditorApi = {
    get doc() {
      return history.doc
    },
    apply: (command: (doc: EditorDoc) => EditorDoc) => void history.apply(command),
    undo: () => history.undo(),
    redo: () => history.redo(),
    get canUndo() {
      return history.canUndo
    },
    get canRedo() {
      return history.canRedo
    },
    importAsNewWork: async (text) => {
      if (!text.startsWith('v2;')) return '読み込めませんでした'
      imported.push(text)
      return null
    },
    aspectRatio: '3:4',
    workName: 'テスト',
  }
  const tools = new Map(createTools(api).map((t) => [t.name, t]))
  const call = async (name: string, input: Record<string, unknown> = {}) => {
    const tool = tools.get(name)
    if (!tool) throw new Error(`no tool ${name}`)
    return JSON.parse(await tool.execute(input))
  }
  return { history, tools, call, imported }
}

describe('WebMCP のツール', () => {
  it('README §5.3 のツールがそろっている', () => {
    const { tools } = setup()
    expect([...tools.keys()]).toEqual([
      'get_editor_state',
      'set_size',
      'add_color',
      'update_color',
      'remove_color',
      'move_color',
      'draw_rows',
      'fill_cells',
      'clear',
      'import_code',
      'export_embed_tag',
      'undo',
      'redo',
    ])
    for (const tool of tools.values()) {
      expect(tool.description.length).toBeGreaterThan(20)
      expect(tool.inputSchema).toMatchObject({ type: 'object' })
    }
    expect(tools.get('get_editor_state')?.annotations).toEqual({ readOnlyHint: true })
    expect(tools.get('export_embed_tag')?.annotations).toEqual({ readOnlyHint: true })
    expect(tools.get('clear')?.annotations).toEqual({ consequentialHint: true })
  })

  it('get_editor_state は行文字列とヒントを返す', async () => {
    const { call } = setup()
    const state = await call('get_editor_state')
    expect(state).toMatchObject({
      work_name: 'テスト',
      size: { width: 15, height: 15 },
      palette: [{ color_number: 1, value: '#000' }],
      has_cells_outside_frame: false,
      can_undo: false,
    })
    expect(state.rows).toHaveLength(15)
    expect(state.rows[0]).toBe('...............')
    expect(state.row_clues[0]).toBe('0')
  })

  it('書き込み系は更新後の状態を返し、1回がアンドゥ1回分', async () => {
    const { call } = setup()
    await call('set_size', { width: 5, height: 5 })
    await call('add_color', { value: '#f00' })
    const state = await call('draw_rows', { x: 0, y: 0, rows: ['11.22', '1'] })
    expect(state.rows.slice(0, 2)).toEqual(['11.22', '1....'])
    expect(state.row_clues[0]).toBe('2:1 2:2')
    expect(state.column_clues[0]).toBe('2:1')
    expect(state.can_undo).toBe(true)
    const undone = await call('undo')
    expect(undone.rows[0]).toBe('.....')
    expect((await call('redo')).rows[0]).toBe('11.22')
  })

  it('fill_cells と色の操作', async () => {
    const { call } = setup()
    await call('set_size', { width: 5, height: 5 })
    await call('add_color', { value: '#f00' })
    await call('fill_cells', {
      cells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      color: 2,
    })
    expect((await call('get_editor_state')).rows[0]).toBe('22...')
    expect((await call('move_color', { color_number: 2, to: 1 })).rows[0]).toBe('11...')
    expect((await call('update_color', { color_number: 1, value: '#0f0' })).palette[0].value).toBe(
      '#0f0',
    )
    expect((await call('remove_color', { color_number: 1 })).rows[0]).toBe('.....')
    expect((await call('fill_cells', { cells: [{ x: 4, y: 4 }], color: 1 })).rows[4]).toBe('....1')
    expect((await call('fill_cells', { cells: [{ x: 4, y: 4 }], color: 0 })).rows[4]).toBe('.....')
  })

  it('不正な入力は何も変えずにエラー', async () => {
    const { call, history } = setup()
    const before = history.doc
    await expect(call('set_size', { width: 3, height: 5 })).rejects.toThrow()
    await expect(call('set_size', { width: '10', height: 5 })).rejects.toThrow(/integer/)
    await expect(call('draw_rows', { x: 10, y: 0, rows: ['111111'] })).rejects.toThrow(
      /does not fit/,
    )
    await expect(call('draw_rows', { x: 0, y: 0, rows: ['2'] })).rejects.toThrow(
      /not in the palette/,
    )
    await expect(call('fill_cells', { cells: [{ x: 99, y: 0 }], color: 1 })).rejects.toThrow()
    await expect(call('add_color', { value: 'red' })).rejects.toThrow()
    await expect(call('remove_color', { color_number: 1 })).rejects.toThrow()
    await expect(call('undo')).rejects.toThrow(/nothing to undo/)
    expect(history.doc).toBe(before)
    expect(history.canUndo).toBe(false)
  })

  it('clear', async () => {
    const { call } = setup()
    await call('draw_rows', { x: 0, y: 0, rows: ['111'] })
    expect((await call('clear')).rows[0]).toBe('...............')
  })

  it('import_code は新しい作品として開く。読めなければエラー', async () => {
    const { call, imported } = setup()
    await call('import_code', { code: 'v2;5x5;5x5;#000;Y2BkAEI4ADEZGIBCDAA' })
    expect(imported).toHaveLength(1)
    await expect(call('import_code', { code: 'nope' })).rejects.toThrow('読み込めませんでした')
  })

  it('export_embed_tag は作品の縦横比を既定にする', async () => {
    const { call } = setup()
    const result = await call('export_embed_tag')
    expect(result.aspect_ratio).toBe('3:4')
    expect(result.embed_tag).toContain('data-aspect-ratio="3:4"')
    expect(result.solution_code).toMatch(/^v2;15x15;15x15;#000;/)
    expect((await call('export_embed_tag', { aspect_ratio: '4:3' })).aspect_ratio).toBe('4:3')
    await expect(call('export_embed_tag', { aspect_ratio: '16:9' })).rejects.toThrow()
  })
})
