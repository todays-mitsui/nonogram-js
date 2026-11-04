/**
 * 進捗の保存と復元(docs/spec/PROGRESS.md)。
 * localStorage や crypto.subtle が使えない環境では、保存せずに遊べるようにする(null を返す)。
 */

import type { Puzzle } from '../core/clue'
import {
  computePuzzleId,
  decodeProgress,
  encodeProgress,
  storageKey,
  type Progress,
} from '../core/progress'

export interface ProgressStore {
  readonly initial: Progress | null
  save(progress: Progress): void
}

export async function openProgressStore(puzzle: Puzzle): Promise<ProgressStore | null> {
  let key: string
  let storage: Storage
  try {
    key = storageKey(await computePuzzleId(puzzle))
    storage = window.localStorage
  } catch {
    return null
  }

  let initial: Progress | null = null
  try {
    const code = storage.getItem(key)
    if (code !== null) initial = await decodeProgress(code, puzzle)
  } catch {
    initial = null
  }

  // 保存は非同期(圧縮)なので、順番が入れ替わらないよう直列にする
  let queue = Promise.resolve()
  return {
    initial,
    save(progress) {
      queue = queue.then(async () => {
        try {
          storage.setItem(key, await encodeProgress(progress))
        } catch {
          // 容量不足などで書けなくても、そのまま遊べるようにする
        }
      })
    },
  }
}
