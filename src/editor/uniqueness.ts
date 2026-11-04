/**
 * 一意解チェックの呼び出し(README §5.1)。判定は Web Worker で動かし、新しい判定を始めたら前のものは止める。
 */

import { derivePuzzle } from '../core/clue'
import { Grid } from '../core/grid'
import { visibleGrid, type SolutionCell } from '../core/solution'
import type { EditorDoc } from './commands'
import type { UniquenessRequest, UniquenessResponse } from './uniqueness.worker'

export const TIME_LIMIT_MS = 3000

export type Uniqueness =
  | { readonly kind: 'line-solvable' | 'needs-guessing' | 'timed-out' }
  /** `alternative` は作問者の正解図と違うほうの解。 */
  | { readonly kind: 'multiple'; readonly alternative: Grid<SolutionCell> }

export class UniquenessChecker {
  #worker: Worker | null = null
  #reject: ((reason: unknown) => void) | null = null

  /** 判定する。次の check() か cancel() が呼ばれたら、この判定は 'cancelled' で reject する。 */
  check(doc: EditorDoc): Promise<Uniqueness> {
    this.cancel()
    const puzzle = derivePuzzle(doc.solution, doc.palette)
    const authored = visibleGrid(doc.solution)
    const worker = new Worker(new URL('./uniqueness.worker.ts', import.meta.url), {
      type: 'module',
    })
    this.#worker = worker
    return new Promise<Uniqueness>((resolve, reject) => {
      this.#reject = reject
      worker.onmessage = (event: MessageEvent<UniquenessResponse>) => {
        this.#finish(worker)
        const data = event.data
        if (data.kind !== 'multiple') {
          resolve({ kind: data.kind })
          return
        }
        const [a, b] = data.solutions.map((cells) =>
          Grid.fromCells(puzzle.size.width, puzzle.size.height, cells),
        ) as [Grid<SolutionCell>, Grid<SolutionCell>]
        resolve({ kind: 'multiple', alternative: a.equals(authored) ? b : a })
      }
      worker.onerror = (event) => {
        this.#finish(worker)
        reject(new Error(event.message))
      }
      worker.postMessage({ puzzle, timeLimitMs: TIME_LIMIT_MS } satisfies UniquenessRequest)
    })
  }

  cancel(): void {
    if (!this.#worker) return
    this.#worker.terminate()
    this.#worker = null
    const reject = this.#reject
    this.#reject = null
    reject?.('cancelled')
  }

  #finish(worker: Worker): void {
    worker.terminate()
    if (this.#worker === worker) {
      this.#worker = null
      this.#reject = null
    }
  }
}
