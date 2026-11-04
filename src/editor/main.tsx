import { render } from 'preact'

function App() {
  return <p>エディタ(準備中)</p>
}

const root = document.getElementById('app')
if (root) render(<App />, root)
