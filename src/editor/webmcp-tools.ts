/**
 * WebMCP で公開するツールの定義(README §5.3)。DOM と WebMCP の API に依存しない。
 * 登録は webmcp.ts が行う。
 *
 * - UI と同じコマンドを呼ぶ。1回の呼び出しがアンドゥ1回分
 * - 入力が不正なら何も変えずに Error を投げる
 * - 書き込み系は、更新後の状態(get_editor_state と同じ JSON)を返す
 */

import { derivePuzzle, type Clue } from '../core/clue'
import { EMPTY, hasCellsOutsideFrame, visibleGrid } from '../core/solution'
import type { AspectRatio } from '../player/widget'
import {
  addColor,
  clear,
  drawRows,
  MAX_COLORS,
  MAX_SIZE,
  MIN_SIZE,
  moveColor,
  paintCells,
  removeColor,
  setSize,
  updateColor,
  type EditorDoc,
} from './commands'
import { exportCode, exportEmbedTag } from './exchange'
import { toRows } from './rows'
import type { Uniqueness } from './uniqueness'

/** ツールが触るエディタの機能。 */
export interface EditorApi {
  readonly doc: EditorDoc
  /** 不正なら EditorCommandError を投げ、状態は変えない。 */
  apply(command: (doc: EditorDoc) => EditorDoc): void
  undo(): void
  redo(): void
  readonly canUndo: boolean
  readonly canRedo: boolean
  /** 読み込めなければエラーメッセージを返す。 */
  importAsNewWork(text: string): Promise<string | null>
  readonly aspectRatio: AspectRatio
  readonly workName: string | null
  /** 一意解チェック。UI と同じ判定(Web Worker、時間制限つき)。 */
  checkUniqueness(): Promise<Uniqueness>
}

export interface ToolDefinition {
  readonly name: string
  readonly title: string
  readonly description: string
  readonly inputSchema: object
  readonly annotations?: {
    readonly readOnlyHint?: boolean
    readonly consequentialHint?: boolean
  }
  execute(input: Record<string, unknown>): Promise<string>
}

export class ToolInputError extends Error {
  override readonly name = 'ToolInputError'
}

const RULES = [
  'Coordinates: x is the column (0 = left), y is the row (0 = top).',
  `The picture is a list of row strings, one character per cell: "." is background, "1"-"9" and "a"-"g" are color numbers 1-16 in the palette.`,
  'Clues are derived from the picture automatically: for each row (left to right) and column (top to bottom), the lengths of runs of the same color.',
  'Runs of the same color need at least one background cell between them; runs of different colors may touch.',
  `Size is ${MIN_SIZE}-${MAX_SIZE} per side; the palette has 1-${MAX_COLORS} colors. Every change can be undone by the user.`,
].join(' ')

const clueText = (clue: Clue, monochrome: boolean) =>
  clue.length === 0
    ? '0'
    : clue.map((e) => (monochrome ? `${e.length}` : `${e.length}:${e.paletteIndex + 1}`)).join(' ')

export function editorState(api: EditorApi): object {
  const { doc } = api
  const puzzle = derivePuzzle(doc.solution, doc.palette)
  const monochrome = doc.palette.length === 1
  return {
    work_name: api.workName,
    size: doc.solution.frame,
    palette: doc.palette.map((value, i) => ({ color_number: i + 1, value })),
    rows: toRows(visibleGrid(doc.solution)),
    row_clues: puzzle.rowClues.map((c) => clueText(c, monochrome)),
    column_clues: puzzle.columnClues.map((c) => clueText(c, monochrome)),
    clue_format: monochrome
      ? 'run lengths separated by spaces; "0" for an empty line'
      : '"length:color_number" separated by spaces; "0" for an empty line',
    has_cells_outside_frame: hasCellsOutsideFrame(doc.solution),
    can_undo: api.canUndo,
    can_redo: api.canRedo,
  }
}

export function createTools(api: EditorApi): ToolDefinition[] {
  const state = () => JSON.stringify(editorState(api))
  const write = (command: (doc: EditorDoc) => EditorDoc) => {
    api.apply(command)
    return state()
  }

  return [
    {
      name: 'get_editor_state',
      title: 'Get the nonogram being edited',
      description: `Returns the nonogram puzzle being edited: size, palette, the picture as row strings, and the clues derived from it. ${RULES}`,
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => state(),
    },
    {
      name: 'set_size',
      title: 'Resize the puzzle',
      description: `Changes the puzzle size (${MIN_SIZE}-${MAX_SIZE} per side). Cells outside a smaller frame are kept and reappear when it grows again. Returns the new state.`,
      inputSchema: {
        type: 'object',
        properties: {
          width: { type: 'integer', minimum: MIN_SIZE, maximum: MAX_SIZE },
          height: { type: 'integer', minimum: MIN_SIZE, maximum: MAX_SIZE },
        },
        required: ['width', 'height'],
      },
      execute: async (input) => write((d) => setSize(d, int(input, 'width'), int(input, 'height'))),
    },
    {
      name: 'add_color',
      title: 'Add a palette color',
      description: `Adds a color to the end of the palette (at most ${MAX_COLORS}). Returns the new state.`,
      inputSchema: {
        type: 'object',
        properties: { value: colorSchema },
        required: ['value'],
      },
      execute: async (input) => write((d) => addColor(d, str(input, 'value'))),
    },
    {
      name: 'update_color',
      title: 'Change a palette color',
      description:
        'Changes the value of a palette color. Cells keep their color number. Returns the new state.',
      inputSchema: {
        type: 'object',
        properties: { color_number: colorNumberSchema, value: colorSchema },
        required: ['color_number', 'value'],
      },
      execute: async (input) =>
        write((d) => updateColor(d, int(input, 'color_number') - 1, str(input, 'value'))),
    },
    {
      name: 'remove_color',
      title: 'Remove a palette color',
      description:
        'Removes a palette color. Its cells become background and later colors are renumbered. The last color cannot be removed. Returns the new state.',
      inputSchema: {
        type: 'object',
        properties: { color_number: colorNumberSchema },
        required: ['color_number'],
      },
      execute: async (input) => write((d) => removeColor(d, int(input, 'color_number') - 1)),
    },
    {
      name: 'move_color',
      title: 'Reorder a palette color',
      description:
        'Moves a palette color to another position. Cells are renumbered so the picture does not change. Returns the new state.',
      inputSchema: {
        type: 'object',
        properties: {
          color_number: colorNumberSchema,
          to: { ...colorNumberSchema, description: 'New color number (position) for the color.' },
        },
        required: ['color_number', 'to'],
      },
      execute: async (input) =>
        write((d) => moveColor(d, int(input, 'color_number') - 1, int(input, 'to') - 1)),
    },
    {
      name: 'draw_rows',
      title: 'Draw with row strings',
      description:
        'Writes row strings with their top-left at (x, y). "." is background, "1"-"9" / "a"-"g" are color numbers, "-" leaves a cell unchanged. The block must fit inside the puzzle. Returns the new state.',
      inputSchema: {
        type: 'object',
        properties: {
          x: { type: 'integer', minimum: 0 },
          y: { type: 'integer', minimum: 0 },
          rows: { type: 'array', items: { type: 'string', pattern: '^[.1-9a-g-]*$' }, minItems: 1 },
        },
        required: ['x', 'y', 'rows'],
      },
      execute: async (input) =>
        write((d) => drawRows(d, int(input, 'x'), int(input, 'y'), strings(input, 'rows'))),
    },
    {
      name: 'fill_cells',
      title: 'Fill cells with one color',
      description:
        'Sets the listed cells to one color number, or to background with color 0. Returns the new state.',
      inputSchema: {
        type: 'object',
        properties: {
          cells: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              properties: {
                x: { type: 'integer', minimum: 0 },
                y: { type: 'integer', minimum: 0 },
              },
              required: ['x', 'y'],
            },
          },
          color: {
            type: 'integer',
            minimum: 0,
            maximum: MAX_COLORS,
            description: '0 = background',
          },
        },
        required: ['cells', 'color'],
      },
      execute: async (input) => {
        const color = int(input, 'color')
        return write((d) => paintCells(d, points(input, 'cells'), color === 0 ? EMPTY : color - 1))
      },
    },
    {
      name: 'clear',
      title: 'Clear the picture',
      description:
        'Sets every cell to background, including cells outside the frame. Returns the new state.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { consequentialHint: true },
      execute: async () => write(clear),
    },
    {
      name: 'import_code',
      title: 'Open a solution code',
      description:
        'Opens a nonogram solution code (v2;…) or an embed tag as a new work. The current work is kept in the work list. Returns the state of the opened work.',
      inputSchema: {
        type: 'object',
        properties: { code: { type: 'string', minLength: 1 } },
        required: ['code'],
      },
      execute: async (input) => {
        const error = await api.importAsNewWork(str(input, 'code'))
        if (error) throw new ToolInputError(error)
        return state()
      },
    },
    {
      name: 'export_embed_tag',
      title: 'Get the embed tag',
      description:
        'Returns the HTML embed tag that shows this puzzle on a web page, and the cropped solution code. It does not copy to the clipboard.',
      inputSchema: {
        type: 'object',
        properties: {
          aspect_ratio: {
            type: 'string',
            enum: ['3:4', '1:1', '4:3'],
            description: 'Widget aspect ratio. Defaults to the one chosen for this work.',
          },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const ratio = optionalRatio(input) ?? api.aspectRatio
        return JSON.stringify({
          embed_tag: await exportEmbedTag(api.doc, ratio),
          solution_code: await exportCode(api.doc),
          aspect_ratio: ratio,
        })
      },
    },
    {
      name: 'check_uniqueness',
      title: 'Check that the puzzle has one solution',
      description:
        'Solves the puzzle from its clues alone. Results: "line_solvable" (each line can be deduced in turn, the friendliest kind of puzzle), "needs_guessing" (one solution, but a solver has to try guesses), "multiple_solutions" (another picture has the same clues; it is returned as alternative_rows), or "timed_out". Exporting is allowed in every case.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const result = await api.checkUniqueness()
        const name = {
          'line-solvable': 'line_solvable',
          'needs-guessing': 'needs_guessing',
          multiple: 'multiple_solutions',
          'timed-out': 'timed_out',
        }[result.kind]
        return JSON.stringify(
          result.kind === 'multiple'
            ? { result: name, alternative_rows: toRows(result.alternative) }
            : { result: name },
        )
      },
    },
    {
      name: 'undo',
      title: 'Undo',
      description: 'Undoes the last change, like the undo button. Returns the new state.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        if (!api.canUndo) throw new ToolInputError('nothing to undo')
        api.undo()
        return state()
      },
    },
    {
      name: 'redo',
      title: 'Redo',
      description: 'Redoes the last undone change, like the redo button. Returns the new state.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        if (!api.canRedo) throw new ToolInputError('nothing to redo')
        api.redo()
        return state()
      },
    },
  ]
}

const colorSchema = {
  type: 'string',
  pattern: '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$',
  description: '#RGB or #RRGGBB',
}
const colorNumberSchema = {
  type: 'integer',
  minimum: 1,
  maximum: MAX_COLORS,
  description: 'Color number in the palette (1 = first color).',
}

function int(input: Record<string, unknown>, key: string): number {
  const value = input[key]
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ToolInputError(`"${key}" must be an integer`)
  }
  return value
}

function str(input: Record<string, unknown>, key: string): string {
  const value = input[key]
  if (typeof value !== 'string') throw new ToolInputError(`"${key}" must be a string`)
  return value
}

function strings(input: Record<string, unknown>, key: string): string[] {
  const value = input[key]
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new ToolInputError(`"${key}" must be an array of strings`)
  }
  return value as string[]
}

function points(input: Record<string, unknown>, key: string): { x: number; y: number }[] {
  const value = input[key]
  if (!Array.isArray(value)) throw new ToolInputError(`"${key}" must be an array of {x, y}`)
  return value.map((p, i) => {
    if (typeof p !== 'object' || p === null) throw new ToolInputError(`${key}[${i}] must be {x, y}`)
    return { x: int(p as Record<string, unknown>, 'x'), y: int(p as Record<string, unknown>, 'y') }
  })
}

function optionalRatio(input: Record<string, unknown>): AspectRatio | null {
  const value = input.aspect_ratio
  if (value === undefined) return null
  if (value === '3:4' || value === '1:1' || value === '4:3') return value
  throw new ToolInputError('"aspect_ratio" must be "3:4", "1:1" or "4:3"')
}
