/**
 * UI 文言(日本語)。docs/README.md §4.6 の叩き台をそのまま置いている。
 * コードに文言を直接書かず、ここから引く。あとで英語を足すときは同じ形のファイルを作る。
 *
 * player.js に エディタの文言が入らないよう、プレイモード用(`player`)とエディタ用(`editor`)を分けて export する。
 */

import type { SolutionCodeErrorReason } from '../core/format'

/** エディタが書き出すタグの中身。JavaScript が動かない環境で読まれる。 */
export const fallback =
  'ここにノノグラム(パズル)があります。JavaScript が動く環境で開くと遊べます。'

/** 正解図コードが不正なときの理由(FORMAT.md の不正条件ごと)。プレイモードとエディタで共有する。 */
export function solutionCodeErrorReason(reason: SolutionCodeErrorReason): string {
  switch (reason.kind) {
    case 'too-few-fields':
      return '項目が足りません'
    case 'unsupported-version':
      return `形式のバージョン「${reason.version}」には対応していません`
    case 'invalid-size':
      return `サイズ「${reason.value}」の書き方が正しくありません`
    case 'frame-exceeds-extent':
      return '可視領域がデータ領域より大きくなっています'
    case 'invalid-color':
      return `色「${reason.value}」の書き方が正しくありません(#RGB か #RRGGBB)`
    case 'too-many-colors':
      return '色が多すぎます(255 色まで)'
    case 'invalid-cells':
      return 'マスデータを読み込めません'
    case 'cells-length-mismatch':
      return 'マスの数がサイズと合いません'
    case 'invalid-cell-value':
      return 'パレットにない色が使われています'
  }
}

export const player = {
  error: {
    cannotDisplay: 'ノノグラムを表示できませんでした。',
    unsupportedBrowser: 'このブラウザではノノグラムを表示できません。',
    invalidSolutionCode: (reason: SolutionCodeErrorReason) =>
      `正解図コードが壊れています: ${solutionCodeErrorReason(reason)}`,
    emptySolution: 'data-solution 属性が空です',
    unknownMode: (value: string) => `data-mode の値「${value}」には対応していません`,
    upgradeBrowser: '新しいブラウザで開いてください',
  },
  dialog: {
    giveUp: {
      message: '答えを見ますか? 見たあとも、リセットすれば解き直せます。',
      confirm: '答えを見る',
      cancel: 'やめる',
    },
    reset: {
      message: '盤面を消して、最初からやり直しますか?',
      confirm: '消してやり直す',
      cancel: 'やめる',
    },
  },
  status: {
    solved: '解けました!',
    revealed: '答えを表示しています',
  },
  announce: {
    solved: 'パズルが解けました',
    revealed: '答えを表示しました',
    reset: '盤面をリセットしました',
  },
  toolbar: {
    paint: '塗る',
    paintColor: (displayNumber: number) => `色${displayNumber}で塗る`,
    cross: '×',
    crossLabel: 'バツを付ける',
    erase: '消す',
    undo: '戻す',
    undoLabel: '元に戻す',
    redo: 'やり直す',
    redoLabel: 'やり直す',
    gridLines: '罫線',
    gridLinesLabel: '罫線を表示',
    reset: 'リセット',
    giveUp: '答えを見る',
  },
} as const

export const editor = {
  import: {
    tooManyColors: (count: number) =>
      `このパズルは ${count} 色あるため、エディタでは開けません(エディタで使えるのは 16 色まで)。プレイモードでは遊べます。`,
    invalidCode: (reason: SolutionCodeErrorReason) =>
      `読み込めませんでした: ${solutionCodeErrorReason(reason)}`,
  },
  export: {
    copied: '埋め込みタグをコピーしました。ブログの記事に貼り付けてください。',
  },
  confirm: {
    removeUsedColor: (displayNumber: number, cellCount: number) =>
      `色${displayNumber}は ${cellCount} マスで使われています。削除すると、そのマスは背景になります。`,
    deleteWork: (name: string) => `「${name}」を削除しますか? 元に戻せません。`,
  },
  uniqueness: {
    lineSolvable: 'ライン推論だけで解けます',
    needsGuessing: '答えは1つですが、仮置きが必要です',
    multipleSolutions: '別の答えがあります',
    timedOut: '判定に時間がかかりすぎたため打ち切りました',
  },
} as const
