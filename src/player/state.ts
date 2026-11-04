/**
 * プレイモードの状態。DOM に依存しない。
 * ウィジェットはこれを操作し、変化を受け取って描画・保存・通知する。
 */

import { BLANK, emptyBoard, type Board, type Mark } from '../core/board'
import { isSolved, satisfaction, type Puzzle, type Satisfaction } from '../core/clue'
import type { Grid, Point } from '../core/grid'
import type { Progress } from '../core/progress'
import { EMPTY, type SolutionCell } from '../core/solution'
import { INITIAL_TOOL, nextMark, Stroke, type Operation, type Tool } from '../core/tool'

/**
 * 1回の操作で起きた変化。
 * - `board`: 盤面が変わった(描き直す)
 * - `commit`: 保存すべき変化があった(ストロークの終わり・アンドゥ・リセット・ギブアップ)
 * - `solved`: 解けていない状態から解けた状態になった(通知する)
 */
export interface Change {
  readonly board: boolean
  readonly commit: boolean
  readonly solved: boolean
  readonly revealed: boolean
  readonly reset: boolean
  readonly tool: boolean
  readonly gridLines: boolean
}

const NO_CHANGE: Change = {
  board: false,
  commit: false,
  solved: false,
  revealed: false,
  reset: false,
  tool: false,
  gridLines: false,
}

export class PlayerState {
  readonly puzzle: Puzzle
  /** 可視領域の正解図。正解表示に使う。 */
  readonly #solution: Grid<SolutionCell>
  #board: Board
  #revealed: boolean
  #tool: Tool = INITIAL_TOOL
  #showGridLines = true
  #undo: Board[] = []
  #redo: Board[] = []
  #stroke: { stroke: Stroke; mark: Mark; before: Board } | null = null
  #satisfaction: Satisfaction
  #solved: boolean
  readonly #listeners = new Set<(change: Change) => void>()

  constructor(puzzle: Puzzle, solution: Grid<SolutionCell>, progress?: Progress | null) {
    this.puzzle = puzzle
    this.#solution = solution
    this.#board = progress?.board ?? emptyBoard(puzzle.size.width, puzzle.size.height)
    this.#revealed = progress?.revealed ?? false
    this.#satisfaction = satisfaction(this.#board, puzzle)
    this.#solved = isSolved(this.#board, puzzle)
  }

  get board(): Board {
    return this.#board
  }
  get tool(): Tool {
    return this.#tool
  }
  get revealed(): boolean {
    return this.#revealed
  }
  get solved(): boolean {
    return this.#solved
  }
  get showGridLines(): boolean {
    return this.#showGridLines
  }
  get satisfaction(): Satisfaction {
    return this.#satisfaction
  }
  get stroking(): boolean {
    return this.#stroke !== null
  }
  /** 解けた・ギブアップ後は記入できない。できるのはリセット(と罫線表示の切り替え)だけ。 */
  get locked(): boolean {
    return this.#solved || this.#revealed
  }
  get canUndo(): boolean {
    return !this.locked && this.#undo.length > 0
  }
  get canRedo(): boolean {
    return !this.locked && this.#redo.length > 0
  }

  /** 表示するマス。正解表示中は正解図。 */
  get displayBoard(): Grid<Mark> {
    if (!this.#revealed) return this.#board
    return this.#solution.map((cell): Mark => (cell === EMPTY ? BLANK : cell))
  }

  get progress(): Progress {
    return { board: this.#board, revealed: this.#revealed }
  }

  subscribe(listener: (change: Change) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  setTool(tool: Tool): void {
    this.#tool = tool
    this.#notify({ tool: true })
  }

  toggleGridLines(): void {
    this.#showGridLines = !this.#showGridLines
    this.#notify({ gridLines: true })
  }

  /** ストロークを始める。最初のマスで適用する記号が決まる。記入できないときは何もしない。 */
  beginStroke(point: Point, operation: Operation): void {
    if (this.locked) return
    const stroke = new Stroke(point, { bounds: this.puzzle.size, lockAxis: true })
    const { x, y } = stroke.start
    const mark = nextMark(this.#board.get(x, y), operation, this.#tool)
    this.#stroke = { stroke, mark, before: this.#board }
    this.#paint([stroke.start])
  }

  strokeTo(point: Point): void {
    if (!this.#stroke) return
    this.#paint(this.#stroke.stroke.moveTo(point))
  }

  /** ストロークを終える。盤面が変わっていればアンドゥ1回分として記録し、保存する。 */
  endStroke(): void {
    if (!this.#stroke) return
    const changed = this.#finishStroke()
    if (changed) this.#notify({ commit: true })
  }

  undo(): void {
    if (!this.canUndo) return
    this.#redo.push(this.#board)
    this.#replaceBoard(this.#undo.pop() as Board, {})
  }

  redo(): void {
    if (!this.canRedo) return
    this.#undo.push(this.#board)
    this.#replaceBoard(this.#redo.pop() as Board, {})
  }

  /** 盤面を全マス未記入に戻す。正解表示も解除する。アンドゥの履歴は消す。 */
  reset(): void {
    this.#stroke = null
    this.#undo = []
    this.#redo = []
    const revealed = this.#revealed
    this.#revealed = false
    this.#replaceBoard(emptyBoard(this.puzzle.size.width, this.puzzle.size.height), {
      reset: true,
      revealed,
    })
  }

  giveUp(): void {
    if (this.#revealed) return
    this.#stroke = null
    this.#undo = []
    this.#redo = []
    this.#revealed = true
    this.#notify({ revealed: true, board: true, commit: true })
  }

  #paint(points: readonly Point[]): void {
    const current = this.#stroke
    if (!current || points.length === 0) return
    const next = this.#board.setMany(points.map(({ x, y }) => ({ x, y, value: current.mark })))
    if (next === this.#board) return
    this.#board = next
    const becameSolved = this.#refresh()
    if (becameSolved) {
      // 解けた瞬間にストロークを打ち切り、記入をロックする
      this.#finishStroke()
      this.#notify({ board: true, commit: true, solved: true })
    } else {
      // ストローク中は描き直すだけ。保存とアンドゥはストロークの終わりにまとめる
      this.#notify({ board: true })
    }
  }

  #finishStroke(): boolean {
    const current = this.#stroke
    this.#stroke = null
    if (!current || current.before === this.#board) return false
    this.#undo.push(current.before)
    this.#redo = []
    return true
  }

  #replaceBoard(board: Board, extra: Partial<Change>): void {
    this.#board = board
    const solved = this.#refresh()
    this.#notify({ ...extra, board: true, commit: true, solved })
  }

  /** 解けていない状態から解けた状態になったら true。 */
  #refresh(): boolean {
    const wasSolved = this.#solved
    this.#satisfaction = satisfaction(this.#board, this.puzzle)
    this.#solved = isSolved(this.#board, this.puzzle)
    return !wasSolved && this.#solved
  }

  #notify(change: Partial<Change>): void {
    const full = { ...NO_CHANGE, ...change }
    for (const listener of this.#listeners) listener(full)
  }
}
