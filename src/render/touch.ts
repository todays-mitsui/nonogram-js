/**
 * タッチでのスクロールの扱い(README §4.2)。
 *
 * マス領域とヒント領域は1枚の canvas なので、`touch-action` では分けられない。canvas には
 * `touch-action: pan-x pan-y` を指定し、マス領域で始まったタッチだけ touchstart で止める。
 * ヒント領域で始まったタッチはスクロールになる。
 */

import type { Puzzle } from '../core/clue'
import { cellAt, type Layout } from './layout'

/** 外すための関数を返す。 */
export function preventScrollOnCellArea(
  canvas: HTMLCanvasElement,
  current: () => { layout: Layout | null; puzzle: Puzzle },
): () => void {
  const onTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]
    if (!touch || e.touches.length > 1) return
    const { layout, puzzle } = current()
    if (!layout) return
    const rect = canvas.getBoundingClientRect()
    if (cellAt(layout, puzzle, touch.clientX - rect.left, touch.clientY - rect.top)) {
      e.preventDefault()
    }
  }
  canvas.addEventListener('touchstart', onTouchStart, { passive: false })
  return () => canvas.removeEventListener('touchstart', onTouchStart)
}
