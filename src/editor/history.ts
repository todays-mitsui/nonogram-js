/**
 * エディタのアンドゥ / リドゥ。コマンド1回、またはストローク1回がアンドゥ1回分。
 */

import type { Point } from '../core/grid'
import { nextSolutionCell, Stroke, type Operation, type Tool } from '../core/tool'
import type { SolutionCell } from '../core/solution'
import { paintCells, type EditorDoc } from './commands'

export class EditorHistory {
  #doc: EditorDoc
  #undo: EditorDoc[] = []
  #redo: EditorDoc[] = []
  #stroke: { stroke: Stroke; value: SolutionCell; before: EditorDoc } | null = null
  readonly #listeners = new Set<(doc: EditorDoc) => void>()

  constructor(doc: EditorDoc) {
    this.#doc = doc
  }

  get doc(): EditorDoc {
    return this.#doc
  }
  get canUndo(): boolean {
    return this.#undo.length > 0
  }
  get canRedo(): boolean {
    return this.#redo.length > 0
  }

  subscribe(listener: (doc: EditorDoc) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  /** コマンドを適用する。コマンドが投げたら状態は変わらない。 */
  apply(command: (doc: EditorDoc) => EditorDoc): EditorDoc {
    this.#endStrokeSilently()
    const next = command(this.#doc)
    if (next !== this.#doc) {
      this.#undo.push(this.#doc)
      this.#redo = []
      this.#set(next)
    }
    return next
  }

  /** 作業を丸ごと置き換える(作品を開いたとき)。履歴は消す。 */
  replace(doc: EditorDoc): void {
    this.#stroke = null
    this.#undo = []
    this.#redo = []
    this.#set(doc)
  }

  undo(): void {
    this.#endStrokeSilently()
    const prev = this.#undo.pop()
    if (!prev) return
    this.#redo.push(this.#doc)
    this.#set(prev)
  }

  redo(): void {
    this.#endStrokeSilently()
    const next = this.#redo.pop()
    if (!next) return
    this.#undo.push(this.#doc)
    this.#set(next)
  }

  /** 作問モードのストローク。方向は固定しない。 */
  beginStroke(point: Point, operation: Operation, tool: Tool): void {
    this.#endStrokeSilently()
    const stroke = new Stroke(point, { bounds: this.#doc.solution.frame, lockAxis: false })
    const { x, y } = stroke.start
    const value = nextSolutionCell(this.#doc.solution.grid.get(x, y), operation, tool)
    this.#stroke = { stroke, value, before: this.#doc }
    this.#paint([stroke.start])
  }

  strokeTo(point: Point): void {
    if (this.#stroke) this.#paint(this.#stroke.stroke.moveTo(point))
  }

  endStroke(): void {
    this.#endStrokeSilently()
  }

  #paint(points: readonly Point[]): void {
    const current = this.#stroke
    if (!current || points.length === 0) return
    const next = paintCells(this.#doc, points, current.value)
    if (next !== this.#doc) this.#set(next)
  }

  #endStrokeSilently(): void {
    const current = this.#stroke
    this.#stroke = null
    if (current && current.before !== this.#doc) {
      this.#undo.push(current.before)
      this.#redo = []
    }
  }

  #set(doc: EditorDoc): void {
    this.#doc = doc
    for (const listener of this.#listeners) listener(doc)
  }
}
