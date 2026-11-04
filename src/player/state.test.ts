import { describe, expect, it } from 'vitest'
import { BLANK, CROSSED, type Mark } from '../core/board'
import { derivePuzzle } from '../core/clue'
import { Grid } from '../core/grid'
import { createSolution, EMPTY, type SolutionCell } from '../core/solution'
import { PlayerState, type Change } from './state'

const _ = EMPTY
// 3x2: 上の行を全部塗れば解ける
const solution = Grid.fromRows<SolutionCell>([
  [0, 0, 0],
  [_, _, _],
])
const puzzle = derivePuzzle(createSolution(solution), ['#000'])

function setup(progress?: { board: Grid<Mark>; revealed: boolean }) {
  const state = new PlayerState(puzzle, solution, progress)
  const changes: Change[] = []
  state.subscribe((c) => changes.push(c))
  return { state, changes }
}

describe('PlayerState', () => {
  it('ストロークで塗り、終わりにアンドゥ1回分として記録する', () => {
    const { state, changes } = setup()
    state.beginStroke({ x: 0, y: 1 }, 'primary')
    state.strokeTo({ x: 2, y: 1 })
    expect(state.board.line({ axis: 'row', index: 1 })).toEqual([0, 0, 0])
    expect(changes.every((c) => !c.commit)).toBe(true)
    state.endStroke()
    expect(changes.at(-1)?.commit).toBe(true)
    state.undo()
    expect(state.board.line({ axis: 'row', index: 1 })).toEqual([BLANK, BLANK, BLANK])
    state.redo()
    expect(state.board.get(1, 1)).toBe(0)
  })

  it('何も変えなかったストロークは記録しない', () => {
    const { state } = setup()
    state.setTool({ kind: 'erase' })
    state.beginStroke({ x: 0, y: 0 }, 'primary')
    state.endStroke()
    expect(state.canUndo).toBe(false)
  })

  it('最初に動いた向きに固定する', () => {
    const { state } = setup()
    state.beginStroke({ x: 0, y: 1 }, 'secondary')
    state.strokeTo({ x: 1, y: 1 })
    state.strokeTo({ x: 2, y: 0 })
    state.endStroke()
    expect(state.board.line({ axis: 'row', index: 1 })).toEqual([CROSSED, CROSSED, CROSSED])
    expect(state.board.line({ axis: 'row', index: 0 })).toEqual([BLANK, BLANK, BLANK])
  })

  it('解けた瞬間にストロークを打ち切ってロックし、solved を1回だけ通知する', () => {
    const { state, changes } = setup()
    state.beginStroke({ x: 0, y: 0 }, 'primary')
    state.strokeTo({ x: 2, y: 0 })
    expect(state.solved).toBe(true)
    expect(state.locked).toBe(true)
    expect(state.stroking).toBe(false)
    expect(changes.filter((c) => c.solved)).toHaveLength(1)
    state.strokeTo({ x: 2, y: 1 })
    state.endStroke()
    expect(state.board.get(2, 1)).toBe(BLANK)
    // 解けたあとはアンドゥできない
    expect(state.canUndo).toBe(false)
    state.beginStroke({ x: 0, y: 1 }, 'primary')
    expect(state.board.get(0, 1)).toBe(BLANK)
  })

  it('復元した盤面が解けていても solved は通知しない', () => {
    const { state, changes } = setup({
      board: Grid.fromRows<Mark>([
        [0, 0, 0],
        [BLANK, BLANK, BLANK],
      ]),
      revealed: false,
    })
    expect(state.solved).toBe(true)
    expect(changes).toHaveLength(0)
  })

  it('ギブアップで正解図を表示し、リセットで解き直せる', () => {
    const { state, changes } = setup()
    state.giveUp()
    expect(state.revealed).toBe(true)
    expect(state.locked).toBe(true)
    expect(state.displayBoard.line({ axis: 'row', index: 0 })).toEqual([0, 0, 0])
    expect(changes.at(-1)).toMatchObject({ revealed: true, commit: true })
    state.reset()
    expect(state.revealed).toBe(false)
    expect(state.locked).toBe(false)
    expect(changes.at(-1)).toMatchObject({ reset: true, revealed: true, commit: true })
  })

  it('リセットはアンドゥの履歴を消す', () => {
    const { state } = setup()
    state.beginStroke({ x: 0, y: 1 }, 'primary')
    state.endStroke()
    state.reset()
    expect(state.canUndo).toBe(false)
    expect(state.board.get(0, 1)).toBe(BLANK)
  })

  it('罫線表示の切り替えは保存しない', () => {
    const { state, changes } = setup()
    state.toggleGridLines()
    expect(state.showGridLines).toBe(false)
    expect(changes.at(-1)).toMatchObject({ gridLines: true, commit: false })
  })
})
