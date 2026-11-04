/// <reference lib="webworker" />
/**
 * 一意解チェックを UI のスレッドの外で動かす。
 * Grid はクラスなので postMessage で送れない。解はマスの配列にして返す。
 */

import type { Puzzle } from '../core/clue'
import { checkUniqueness } from '../core/solver'
import type { SolutionCell } from '../core/solution'

export interface UniquenessRequest {
  readonly puzzle: Puzzle
  readonly timeLimitMs: number
}

export type UniquenessResponse =
  | { readonly kind: 'line-solvable' | 'needs-guessing' | 'timed-out' }
  | {
      readonly kind: 'multiple'
      readonly solutions: readonly [readonly SolutionCell[], readonly SolutionCell[]]
    }

self.onmessage = (event: MessageEvent<UniquenessRequest>) => {
  const { puzzle, timeLimitMs } = event.data
  const result = checkUniqueness(puzzle, { timeLimitMs })
  const response: UniquenessResponse =
    result.kind === 'multiple'
      ? {
          kind: 'multiple',
          solutions: [result.solutions[0].toCells(), result.solutions[1].toCells()],
        }
      : { kind: result.kind }
  self.postMessage(response)
}
