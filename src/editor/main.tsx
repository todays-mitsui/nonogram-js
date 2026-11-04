import { render } from 'preact'
import './editor.css'
import { createEditor } from './store'
import { App } from './ui/App'
import { registerWebMcpTools } from './webmcp'
import { browserStorage, WorkStore } from './works'

const editor = createEditor(new WorkStore(browserStorage()))
const root = document.getElementById('app')

void editor.start().then(() => {
  if (root) render(<App editor={editor} />, root)
  registerWebMcpTools(editor)
})

// 同じタブで別の共有 URL を開いたとき
window.addEventListener('hashchange', () => void editor.start())
