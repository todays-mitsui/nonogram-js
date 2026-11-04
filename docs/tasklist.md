# Tasklist

仕様は [README.md](README.md)、用語は [spec/GLOSSARY.md](spec/GLOSSARY.md)。

## Phase 0: 仕様を固める

- [x] 進捗コードの形式を決め、spec/PROGRESS.md に移す(GLOSSARY Open Question 1 を閉じる)
- [x] PuzzleId の正規形を決め、spec/PROGRESS.md に移す → 色数は含めない
- [x] 埋め込みタグの仕様を spec/EMBED.md として切り出す
- [ ] はてなブログで `<div class="todays-mitsui__nonogram" data-solution>` + `<script>` が残るか、各編集モード・AMP・一覧ページで確認する(Open Question 1)
- [x] 一意解チェックの基準を決める → ラインソルバー + バックトラックの4段階表示
- [x] リポジトリ名(= Pages の URL)を確定する → `nonogram-js`
- [x] 独自ドメインを使うか決める → 使わない(github.io のまま。アカウント名・リポジトリ名を変えない)
- [x] エディタの UI フレームワーク → Preact + Signals
- [x] UI 文言の言語 → 日本語のみ、`src/i18n/ja.ts` に集める
- [x] ライセンス → MIT
- [x] README §5.3 WebMCP のツール一覧と行文字列の形式を確定する
- [x] WebMCP のオリジントライアル → 登録して公開版でも有効にする
- [x] エディタの作品保存 → 複数作品の一覧(README §5.4)
- [x] エディタのサイズの範囲 → 5〜100
- [x] core の npm 公開 → しない。仕様をドキュメントとして公開するだけ
- [x] エディタの色数の上限 → 16 色
- [x] ギブアップ後 → リセットで `revealed` も解除して解き直せる
- [x] テストプレイの進捗 → 保存しない
- [x] 狭い画面 → `cellSize` が下限を割ったらキャンバス内でスクロール(ズーム・全画面なし)
- [x] レイアウト → 縦横比でウィジェットの枠を決め、パズルをキャンバスに収める
- [x] `data-aspect-ratio` の省略時 → `1:1`
- [x] 罫線表示 → MVP に入れる(保存しない)
- [x] ダークモード → マス領域だけ常に明るい背景
- [x] ストロークの方向固定 → プレイは固定、作問は自由
- [x] localStorage の接頭辞 → `todays-mitsui/nonogram:`
- [x] 経過時間 → 表示しない
- [x] ヒント項目の手動の消し込み → Backlog
- [x] 古い進捗の掃除 → しない(書き込み失敗は無視)
- [ ] 文言の叩き台(README §4.6)を確定する
- [x] 最初のタグを配る条件 → Phase 2(プレイモード MVP)+ はてなブログでの確認(下の「v1 公開」)
- [x] `cellSize` → 16〜40px
- [x] 確認ダイアログ → Shadow DOM 内の `<dialog>`
- [x] 色の区別の補助 → 今はしない(Backlog)
- [x] プレイモードのツールバー → キャンバスの下(縦横比を入れたので吸着はやめた)
- [x] 新規作品の初期状態 → 15x15、黒1色
- [x] 解けたあと → リセットだけできる。演出はメッセージ + ヒント・罫線を薄く(アニメーションなし)

## Phase 1: 基盤

- [x] リポジトリ初期化(git、TypeScript 6.0、Vite 8、Vitest 5、ESLint 10 / Prettier、Preact、LICENSE(MIT))
- [x] `src/i18n/ja.ts`: UI 文言の置き場所
- [x] GitHub Actions: テスト + GitHub Pages へのデプロイ(テストが通ったときだけデプロイ)
- [ ] 古いメジャーバージョンの `player.js` をデプロイ成果物に残す仕組み(v2 を出す前に用意する)
- [x] `core/grid.ts`: `Grid<T>`(座標、ラインの取り出し、リサイズ)
- [x] `core/format.ts`: `encodeSolution` / `decodeSolution`
  - [x] FORMAT.md の例2つをテストケースにする
  - [x] 不正条件をすべてテストする
  - [x] エンコード時のデータ領域の切り詰め
- [x] `core/solution.ts`: `Solution`、`Extent` の計算、`crop`
- [x] `core/clue.ts`: ヒントの導出(色付きブロック、空ライン = `[]`)、`satisfied` の判定
- [x] `core/tool.ts`: `Tool`、`nextMark`、`Stroke`(プレイモード / 作問モード両方)
- [x] `core/progress.ts`: `encodeProgress` / `decodeProgress`、`PuzzleId`
  - [x] PROGRESS.md の例をテストケースにする(ハートの PuzzleId、進捗コード)
  - [x] 復元時に捨てる条件をすべてテストする

## Phase 2: プレイモード(MVP)

- [ ] `render/`: Canvas でマス領域・ヒント領域・罫線・区切り線を描画(hi-DPI 対応)
- [ ] レイアウト: 親の幅 × `aspectRatio` でウィジェットの大きさを決め、キャンバスに収まる `cellSize`(16〜40px)を計算、`ResizeObserver`、下限を割ったらキャンバス内でスクロール
- [ ] `data-aspect-ratio` の読み取り(省略時・不正値は `1:1`)
- [ ] 罫線表示(`showGridLines`)の切り替えボタン(非表示時はバツも隠す)
- [ ] ポインタ操作: 主操作・副操作・ストローク(プレイモードは最初に動いた向きに固定)、`touch-action: none`
- [ ] ツールバー(Shadow DOM 内の DOM、キャンバスの下)、モノクロ / カラーで候補を切り替え
- [ ] `satisfied` のグレーアウト、`solved` の判定と完成表示(バツを消してロック、ヒント・罫線を薄く、「解けました」、リセットだけ可)
- [ ] ギブアップ(`revealed`)、リセット(`revealed` も解除)。確認は Shadow DOM 内の `<dialog>`
- [ ] アンドゥ / リドゥ
- [ ] 進捗の自動保存と復元(localStorage / `crypto.subtle` が使えない環境のフォールバック)
- [ ] `player.js` エントリ: EMBED.md のマウント手順(`DOMContentLoaded` 待ち、`MutationObserver`、取り除かれたら監視を解除)、二重読み込み対策、`window.TodaysMitsuiNonogram`(`version` / `mount`)、Shadow DOM は `open`
- [ ] 不正な正解図コードのエラー表示(README §4.6 の不正条件ごとの理由)
- [ ] 非対応ブラウザ(`DecompressionStream` の `deflate-raw` なし)の検出と表示
- [ ] ダークモード(マス領域の背景は明るいまま)
- [ ] IIFE 単一ファイルでビルド、`/player/v1/player.js` に配置、サイズ確認(gzip 30 KB 以下)
- [ ] 手書きの埋め込みタグを置いたデモページ

### v1 公開(ここから互換を守る)

- [ ] はてなブログの実記事で動作確認(PC / スマホ / 一覧ページ、各編集モード)
- [ ] 主要ブラウザでの動作確認(Chrome / Safari iOS / Firefox)
- [ ] 埋め込みタグの仕様(spec/EMBED.md)・正解図コード・保存キーを凍結し、最初の記事に貼る

## Phase 3: エディタ(MVP)

- [ ] 画面の骨組み(GitHub Pages の `/editor/`)
- [ ] `editor/commands.ts`: 状態変更をすべてコマンドにする(UI と WebMCP で共有、アンドゥの単位)。UI より先に作る
- [ ] サイズ変更(枠外のマスを保持)
- [ ] パレット編集(1〜16 色。追加・削除・並べ替え・値の変更、`PaletteIndex` の振り直し)
- [ ] 描画(塗り / 消しゴム、ストローク、トグル)
- [ ] ヒントのリアルタイムプレビュー
- [ ] 書き出し: 埋め込みタグの生成とクリップボードへのコピー(縦横比の選択とプレビュー、作品ごとに最後の選択を覚える)
- [ ] 読み込み: 正解図コード / 埋め込みタグの貼り付け(17 色以上は理由を示して拒否)
- [ ] 作品の一覧(新規作成・開く・複製・名前の変更・削除)
- [ ] 作業の自動保存(localStorage、README §5.4 のキー)と URL の `#` での共有・取り込み
- [ ] アンドゥ / リドゥ
- [ ] テストプレイ(進捗は保存しない)

## Phase 3.5: エディタの WebMCP 対応

- [ ] `core/`: 行文字列 ⇄ `Grid<empty | PaletteIndex>` の変換(`.`、`1`〜`9`、`a`〜`g`、`-`)
- [ ] `editor/webmcp.ts`: 機能検出(`document.modelContext`)と `registerTool`、`AbortSignal` でまとめて解除
- [ ] 読み取り系ツール: `get_editor_state`、`export_embed_tag`
- [ ] 書き込み系ツール: `set_size`、パレット操作4種、`draw_rows`、`fill_cells`、`clear`、`import_code`、`undo` / `redo`
- [ ] 不正入力で状態を変えずにエラーを返すことのテスト(ツールごと)
- [ ] `inputSchema` と `description`(英語)を書き、`annotations` を付ける
- [ ] エージェントから実際に作問させて、description の分かりやすさを確かめる(Chrome)
- [ ] Phase 4 のソルバーができたら `check_uniqueness` を追加
- [ ] オリジントライアルに登録し、トークンを `/editor/` の `<meta>` に入れる
- [ ] トークンの期限を記録し、更新を忘れない仕組み(期限の1か月前に Issue を立てる Actions など)

## Phase 4: 品質と公開

- [ ] `core/solver.ts`: ラインソルバー(カラー対応)
- [ ] `core/solver.ts`: バックトラック(解を2つまで探す、中断・時間制限つき)
- [ ] Web Worker で一意解チェックを動かし、描画のたびに前の判定を中断する
- [ ] エディタに一意解チェックの4段階の結果を表示(別解ありなら2つ目の解も)
- [ ] エディタを含めて、はてなブログ・主要ブラウザで再確認
- [ ] 利用者向けドキュメント(タグの貼り方、正解図コードの仕様へのリンク)
- [ ] spec/(FORMAT.md など)を GitHub Pages でドキュメントとして公開する

## Backlog

- [ ] カラー問題でヒント項目をタップ / クリックすると、その色の塗りツールに切り替える(README §4.1「ヒントで色を選ぶ」)
- [ ] マス領域のキーボード操作(矢印キー + Space)
- [ ] 画像からの取り込み(減色してパレット作成)
- [ ] 平行移動・反転・回転
- [ ] 鑑賞モード(`Viewer`、`data-mode="viewer"`)
- [ ] 補助機能(`Hint`: 間違っているマスを教える)
- [ ] ヒント項目の手動の消し込み(進捗コードに済み印を足す)
- [ ] 色の区別の補助: 表示番号を色見本・ヒント項目・マスに重ねる切り替え
- [ ] エディタ: 似た色がパレットにあるときの警告
