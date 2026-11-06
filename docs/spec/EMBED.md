# 埋め込みタグ仕様 (player v1)

Web ページにノノグラムを置くための HTML の書き方と、`player.js` がそれをどう扱うかの約束。用語は [GLOSSARY.md](GLOSSARY.md) に従う。

この仕様は公開仕様とする。エディタの書き出しを使わず、手で書いたり外部ツールで作ったりしてもよい。

---

## タグの形

```html
<div class="todays-mitsui__nonogram"
     data-solution="v2;5x5;5x5;#000;Y2BkAEI4ADEZGIBCDAA"
     data-aspect-ratio="1:1">ここにノノグラム(パズル)があります。JavaScript が動く環境で開くと遊べます。</div>
<script src="https://todays-mitsui.github.io/nonogram-js/player/v1/player.js" defer></script>
```

埋め込み要素と `<script>` の2つから成る。

---

## 埋め込み要素(`MountElement`)

### 要素とクラス名

- `class` に `todays-mitsui__nonogram` を含み、`data-solution` 属性を持つ要素。`player.js` はセレクタ `.todays-mitsui__nonogram[data-solution]` で探す
- 要素の種類は問わないが `<div>` を推奨する。Shadow DOM を付けられる要素(`div`・`section`・`article` など)でなければならない
- クラス名に作者名の接頭辞を付けているのは、ブログのテーマや他のスクリプトとの衝突を避けるため
- 他のクラスを併記してよい(`class="todays-mitsui__nonogram my-puzzle"`)

### 属性

| 属性 | 必須 | 値 | 省略時・不正な値のとき |
|---|---|---|---|
| `data-solution` | ○ | 正解図コード([FORMAT.md](FORMAT.md))。書き出し後(可視領域 = データ領域)のものを置く | 空ならエラー表示 |
| `data-aspect-ratio` | | キャンバス(パズルを描く部分。ツールバーを除く)の縦横比。`3:4`(縦長)/ `1:1`(正方形)/ `4:3`(横長) | `1:1` |
| `data-mode` | (予約) | `player`。将来 `viewer`(鑑賞モード)を受け付ける | `player`。未知の値はエラー表示(書き間違いに気づけるようにするため) |

- 作問側の保存(可視領域 ⊊ データ領域)の正解図コードを置いてもよい。プレイモードは可視領域の中だけを使い、枠外のマスは無視する
- 上の表にない `data-*` 属性は無視する。将来の拡張のため、`data-` に続けて上の表にない名前を使うのは避ける(他のスクリプト用の属性と衝突しうる)
- マウントした後に属性を書き換えても反映しない

### 中身(フォールバック)

- 要素の中身は、JavaScript が動かない環境(RSS リーダー、AMP、JS 無効)向けのフォールバックとして書く。書き出しの既定の文は「ここにノノグラム(パズル)があります。JavaScript が動く環境で開くと遊べます。」
- `player.js` は中身を書き換えも削除もしない。要素に Shadow DOM を付けると、中身は表示されなくなる
- 中身は空でもよい

---

## `<script>`

- `src` は `https://todays-mitsui.github.io/nonogram-js/player/v1/player.js`
- `defer` を付けることを推奨する。`async` や属性なしでも動く。`type="module"` にはしない(`player.js` は IIFE)
- 埋め込み要素より前に置いても後に置いてもよい
- 1ページに複数のパズルを置くとき、パズルごとに `<script>` を書いてよい。何度読み込まれても初期化は1回だけ行う

---

## `player.js` の振る舞い

### マウント

1. 読み込まれたら、ページ内の `.todays-mitsui__nonogram[data-solution]` のうち未マウントのものをすべてマウントする。DOM の構築が終わっていなければ `DOMContentLoaded` を待つ
2. `MutationObserver` で、後から追加された埋め込み要素もマウントする(無限スクロールや PJAX のテーマ向け)
3. マウントした要素には `data-todays-mitsui-nonogram-mounted` 属性を付け、二重にマウントしない。属性名の接頭辞はクラス名と揃えている
4. ページから取り除かれた埋め込み要素は、監視(`ResizeObserver` など)を解除する

### 描画

- 埋め込み要素に Shadow DOM を付け、その中にウィジェットを描画する。ブログテーマの CSS の影響を受けないようにするため
- Shadow DOM は `open` で付ける(ハッカブルにするため。外から `el.shadowRoot` で中身を調べられる)
- 埋め込み要素はブロック要素として表示し、幅は親要素いっぱいにする。高さは、幅と `data-aspect-ratio` で決まるキャンバスの高さに、ツールバーの高さを足したもの。埋め込み要素自体に幅・高さの CSS を指定しないでほしい(指定した場合は、その幅に合わせ、高さは縦横比とツールバーから決まる高さで上書きする)
- レイアウトの詳細は README §4.2

### エラー

- 正解図コードが不正なとき、またはブラウザが必要な API(`DecompressionStream` の `deflate-raw` など)を持たないときは、ウィジェットの代わりにエラーメッセージを Shadow DOM 内に表示する。文言は README §4.6
- エラーはその埋め込み要素の中だけに閉じ、他のパズルやページ全体には影響させない。`console.error` にも理由を出す

### 進捗

- 解答者の進捗は、そのページのオリジンの localStorage に保存する。キーは `todays-mitsui/nonogram:progress:{PuzzleId}`([PROGRESS.md](PROGRESS.md))
- 同じパズルを1ページに2つ置くと、2つは同じ進捗キーを使う。互いの画面は同期せず、後から保存した方が残る

---

## JavaScript API

グローバルには `window.TodaysMitsuiNonogram` だけを公開する。クラス名・保存キーと同じく、他のスクリプトとの衝突を避けるため作者名を接頭辞にしている。

| メンバ | 型 | 内容 |
|---|---|---|
| `version` | `string` | `player.js` のバージョン(semver。例 `1.2.0`) |
| `mount(el)` | `(el: Element) => Promise<void>` | 指定した要素をマウントする。自動マウントの対象外のタイミングで手動でマウントしたいとき用。マウント済みなら何もしない。正解図コードが不正でも reject せず、エラー表示をして resolve する |

- `window.TodaysMitsuiNonogram` がすでにあれば、2回目以降に読み込まれた `player.js` は何もしない(二重読み込みの検出)
- これ以外のプロパティは内部用で、互換を保証しない

---

## 互換性の約束

- URL のパスにメジャーバージョンを入れる(`/player/v1/`)。**v1 の URL は消さず、v1 の中では後方互換を守る**。ブログに貼られたタグは書き換えられないため
- v1 の中で変えないもの
  - クラス名 `todays-mitsui__nonogram` と、上の属性の名前・値の意味
  - 正解図コードの v2 形式の読み込み
  - 進捗の保存キーと進捗コード `p1` の読み込み(変えると解答者の進捗が消える)
  - `window.TodaysMitsuiNonogram` の `version` と `mount`
  - マウント済みの印 `data-todays-mitsui-nonogram-mounted`(外のスクリプトがマウント済みかを調べるのに使える)
- v1 の中で足してよいもの:新しい属性、`data-mode` の新しい値(それまでエラー表示だった値が動くようになる)、`data-aspect-ratio` の新しい値、新しい正解図コードの版の読み込み、見た目の改善
- 上の「変えないもの」を壊す変更をするときは `/player/v2/` を新設する
- v1 の中の修正は約 10 分で、貼られたすべてのページに届く(GitHub Pages のキャッシュが 10 分のため)
