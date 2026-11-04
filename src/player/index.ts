/**
 * 埋め込み用エントリ(player.js)。docs/spec/EMBED.md の約束どおりに動く。
 *
 * - グローバルは window.TodaysMitsuiNonogram だけ。すでにあれば何もしない(二重読み込み)
 * - DOM の構築を待って、ページ内の埋め込み要素をすべてマウントする
 * - 後から追加された埋め込み要素も MutationObserver でマウントする
 */

import { mount, MOUNTED_ATTRIBUTE, resume, SELECTOR, suspend } from './mount'

declare const __PLAYER_VERSION__: string

interface PlayerGlobal {
  readonly version: string
  readonly mount: (el: Element) => Promise<void>
}

const GLOBAL_NAME = 'TodaysMitsuiNonogram'
const globals = window as unknown as Record<string, PlayerGlobal | undefined>

if (!globals[GLOBAL_NAME]) {
  globals[GLOBAL_NAME] = Object.freeze({ version: __PLAYER_VERSION__, mount })
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
}

function start(): void {
  mountWithin(document)
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) mountWithin(node)
      }
      for (const node of record.removedNodes) {
        if (node instanceof Element) suspendWithin(node)
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true })
}

function each(root: ParentNode, selector: string, fn: (el: Element) => void): void {
  if (root instanceof Element && root.matches(selector)) fn(root)
  root.querySelectorAll(selector).forEach(fn)
}

function mountWithin(root: ParentNode): void {
  each(root, SELECTOR, (el) => {
    if (el.hasAttribute(MOUNTED_ATTRIBUTE)) resume(el)
    else mount(el).catch((error) => console.error('[nonogram]', error))
  })
}

function suspendWithin(root: Element): void {
  // 移動(取り除いてすぐ戻す)なら止めない
  queueMicrotask(() => {
    each(root, `[${MOUNTED_ATTRIBUTE}]`, (el) => {
      if (!el.isConnected) suspend(el)
    })
  })
}

export {}
