/**
 * WebMCP のツール登録(README §5.3)。`document.modelContext` がなければ何もしない。
 * WebMCP の仕様はまだ Draft なので、API の違いはこのファイルで吸収する。
 */

import type { Editor } from './store'
import { createTools, type EditorApi } from './webmcp-tools'

interface ModelContext {
  registerTool(tool: object, options?: { signal?: AbortSignal }): Promise<void> | void
}

/** ツールを登録し、解除する関数を返す。WebMCP がなければ null。 */
export function registerWebMcpTools(editor: Editor): (() => void) | null {
  const context = (document as Document & { modelContext?: ModelContext }).modelContext
  if (!context || typeof context.registerTool !== 'function') return null

  const api: EditorApi = {
    get doc() {
      return editor.history.doc
    },
    // UI の apply と違い、エラーは notice に出さずにそのまま投げる(エージェントに返す)
    apply: (command) => void editor.history.apply(command),
    undo: () => editor.history.undo(),
    redo: () => editor.history.redo(),
    get canUndo() {
      return editor.history.canUndo
    },
    get canRedo() {
      return editor.history.canRedo
    },
    importAsNewWork: (text) => editor.importAsNewWork(text),
    get aspectRatio() {
      return editor.aspectRatio.value
    },
    get workName() {
      return editor.work.value?.name ?? null
    },
    checkUniqueness: () => editor.checkUniqueness(),
  }

  const controller = new AbortController()
  for (const tool of createTools(api)) {
    try {
      void Promise.resolve(context.registerTool(tool, { signal: controller.signal })).catch(
        (error: unknown) =>
          console.warn(`[nonogram] WebMCP: ${tool.name} を登録できませんでした`, error),
      )
    } catch (error) {
      console.warn(`[nonogram] WebMCP: ${tool.name} を登録できませんでした`, error)
    }
  }
  return () => controller.abort()
}
