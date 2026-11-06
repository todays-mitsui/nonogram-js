/**
 * ウィジェットの Shadow DOM 内のスタイル。ブログテーマの CSS の影響を受けない。
 */

import { widgetCss } from '../render/theme'

const vars = (theme: Record<string, string>) =>
  Object.entries(theme)
    .map(([name, value]) => `--${name}: ${value};`)
    .join(' ')

export const css = `
:host { display: block; }
.widget {
  ${vars(widgetCss.light)}
  box-sizing: border-box;
  width: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 12px;
  font-family: system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  text-align: left;
}
@media (prefers-color-scheme: dark) {
  .widget { ${vars(widgetCss.dark)} }
}
/* 縦横比はここに指定する(widget.ts)。幅はウィジェットいっぱい、高さは幅 × 縦横比 */
.canvas-area {
  position: relative;
  width: 100%;
  flex: none;
}
.canvas-scroll {
  position: absolute;
  inset: 0;
  display: flex;
  overflow: auto;
}
canvas {
  display: block;
  margin: auto;
  /* ヒント領域ではなぞってスクロールできるように。マス領域では widget.ts の touchstart で止める */
  touch-action: pan-x pan-y;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
/* キャンバス領域の上端に重ねる。出ても消えてもウィジェットの高さは変わらない */
.status {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100% - 16px);
  box-sizing: border-box;
  margin: 0;
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--dialog-bg);
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.15);
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  pointer-events: none;
}
.status[hidden] { display: none; }
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}
.group { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
button {
  box-sizing: border-box;
  height: 44px;
  min-width: 44px;
  margin: 0;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 8px;
  border: 1px solid var(--btn-border);
  background: var(--btn-bg);
  color: var(--text);
  font: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
button[aria-pressed='true'] { border: 2px solid var(--accent); background: var(--accent-soft); }
button:disabled { opacity: 0.4; cursor: default; }
button:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
button.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); font-weight: 600; }
.symbol { font-size: 18px; }
.swatch {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
  background: var(--overlay);
}
.overlay[hidden] { display: none; }
dialog {
  position: static;
  max-width: 340px;
  margin: 0;
  padding: 20px;
  box-sizing: border-box;
  border: none;
  border-radius: 12px;
  background: var(--dialog-bg);
  color: var(--text);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
}
dialog p { margin: 0 0 16px; font-size: 15px; line-height: 1.6; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 120px;
  text-align: center;
}
.error p { margin: 0; }
.error .title { font-size: 15px; font-weight: 600; }
.error .detail { font-size: 12px; color: var(--muted); }
`
