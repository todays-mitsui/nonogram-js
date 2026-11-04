/**
 * 埋め込み要素のマウント(docs/spec/EMBED.md)。
 */

import { derivePuzzle } from '../core/clue'
import { decodeSolution, SolutionCodeError } from '../core/format'
import { visibleGrid } from '../core/solution'
import { player as t } from '../i18n/ja'
import { openProgressStore } from './storage'
import { renderError, Widget, type AspectRatio } from './widget'

export const SELECTOR = '.todays-mitsui__nonogram[data-solution]'
export const MOUNTED_ATTRIBUTE = 'data-todays-mitsui-nonogram-mounted'

const ASPECT_RATIOS: readonly AspectRatio[] = ['3:4', '1:1', '4:3']
const widgets = new WeakMap<Element, Widget>()

/** マウント済みなら何もしない。正解図コードが不正でも reject せず、エラーを表示して resolve する。 */
export async function mount(el: Element): Promise<void> {
  if (el.hasAttribute(MOUNTED_ATTRIBUTE)) return
  el.setAttribute(MOUNTED_ATTRIBUTE, '')

  let root: ShadowRoot
  try {
    root = el.attachShadow({ mode: 'open' })
  } catch (error) {
    console.error('[nonogram] この要素には Shadow DOM を付けられません', el, error)
    return
  }

  const fail = (detail: string, title: string = t.error.cannotDisplay, cause?: unknown) => {
    console.error(`[nonogram] ${title} ${detail}`, el, ...(cause ? [cause] : []))
    renderError(root, title, detail)
  }

  const mode = el.getAttribute('data-mode') ?? 'player'
  if (mode !== 'player') return fail(t.error.unknownMode(mode))

  const code = (el.getAttribute('data-solution') ?? '').trim()
  if (code === '') return fail(t.error.emptySolution)

  if (!supportsDeflateRaw()) return fail(t.error.upgradeBrowser, t.error.unsupportedBrowser)

  let decoded
  try {
    decoded = await decodeSolution(code)
  } catch (error) {
    if (error instanceof SolutionCodeError) {
      return fail(t.error.invalidSolutionCode(error.reason), t.error.cannotDisplay, error)
    }
    throw error
  }

  const puzzle = derivePuzzle(decoded.solution, decoded.palette)
  const store = await openProgressStore(puzzle)
  widgets.set(
    el,
    new Widget(root, {
      puzzle,
      solution: visibleGrid(decoded.solution),
      aspectRatio: parseAspectRatio(el.getAttribute('data-aspect-ratio')),
      store,
    }),
  )
}

/** 取り除かれた要素の監視を止める。戻ってきたら resume() で再開する。 */
export function suspend(el: Element): void {
  widgets.get(el)?.suspend()
}

export function resume(el: Element): void {
  widgets.get(el)?.resume()
}

function parseAspectRatio(value: string | null): AspectRatio {
  return ASPECT_RATIOS.find((r) => r === value?.trim()) ?? '1:1'
}

function supportsDeflateRaw(): boolean {
  try {
    new DecompressionStream('deflate-raw')
    return typeof ResizeObserver === 'function'
  } catch {
    return false
  }
}
