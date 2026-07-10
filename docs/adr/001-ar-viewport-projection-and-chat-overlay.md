# ADR-001: ARビューポートは投影行列で同期し、チャットは透過オーバーレイで重ねる

- **Status**: Accepted
- **Date**: 2026-07-10
- **Decision Makers**: PdM（寺田）+ Claude Code（調査・起案）
- **関連Issue**: [#36](https://github.com/Cor-Incorporated/ar-avatar-chat/issues/36)（AR歪み・位置ズレ）, [#37](https://github.com/Cor-Incorporated/ar-avatar-chat/issues/37)（キーボード時の押し上げ・消失）, [#38](https://github.com/Cor-Incorporated/ar-avatar-chat/issues/38)（Gemini 3.1 GA化・会話高度化）, [#39](https://github.com/Cor-Incorporated/ar-avatar-chat/issues/39)（MindAR調査 spike）, [#40](https://github.com/Cor-Incorporated/ar-avatar-chat/issues/40)（TTS読み上げ）

## Context（背景）

モバイル実機で2系統のクリティカル問題が継続発生している。

1. **AR表示不良**: マーカー上の期待位置にアバターが出ない／モデルが極端に細く（縦横比が歪んで）表示される
2. **チャット時の破綻**: ソフトキーボード表示でAR画面が上に押し上げられアバターが見えない／マーカーロストでアバターが即座に消える

### 対症療法の履歴（git logで裏取り済み）

PR #15, #17, #19, #21, #23, #25, #27, #29, #31 と、**カメラ映像・canvas・シーンのDOM矩形を揃え直す修正が9回近く繰り返された**が根治していない。現行実装はその集大成として `syncARLayers()`（`src/index.html:245-511`）が resize/visualViewportイベントに加え **500ms間隔のポーリング**で video / canvas / a-scene のDOM矩形を `!important` CSSとインラインスタイルで強制同期している。

### 特定した根本原因（コードリーディングによる。実装時に実機計測で裏取りすること）

| # | 症状 | 根本原因 | 該当箇所 |
|---|------|---------|---------|
| 1 | モデルが細い／位置ズレ | `arjs` 設定に `sourceWidth/sourceHeight/displayWidth/displayHeight` がなく、AR.jsデフォルト640x480（横長）でARToolkitコンテキストが初期化される。モバイル縦向きのポートレートストリームとアスペクト不一致のまま**投影行列**が生成されるが、`syncARLayers()` はDOM矩形しか触らず `camera.projectionMatrix` を更新しない | `src/index.html:183`（arjs設定）、`src/index.html:245-511` |
| 2 | 位置ズレ（下半身沈み） | vrm-loaderがバウンディングボックスの**中心(x,y,z)**をマーカー原点に合わせるため、モデルの胴体中心がマーカー面と一致し、足元がマーカー面下に沈む | `src/components/vrm-loader.js:39-45` |
| 3 | チャット中の押し上げ・消失 | iOS Safariはフォーカス中レイアウトビューポートを**継続的に**パンするが、復元は**イベント毎に単発のrequestAnimationFrame**のみで追従しきれない。さらにAR.jsのデフォルト動作で markerLost 時にアバターが即非表示になり、猶予がない | `src/components/BottomSheet.ts:250-257`、`src/index.html:629-658` |

### 検証済みの周辺事実

- 本番（https://ar-avatar-chat.vercel.app）は **mainブランチ自動デプロイ**（Vercel deployments APIで確認、最新production = main @ 6a31a21）。ブランチ毎にプレビューURL（`ar-avatar-chat-git-<branch>-….vercel.app`）が発行される
- 画像添付 → Gemini vision（inlineData ≤3枚）は実装・本番配信済み（配信中 `/dist/src/components/BottomSheet.js` をフェッチして確認）。ただしUIは無ラベルの小さな「+」ボタンのみで気づけない
- サーバーのモデルは `gemini-3.1-flash-lite-preview`（`server/services/gemini.service.ts:87`）だが、CLAUDE.md/READMEは「Gemini 2.5 Flash」のまま陳腐化
- 会話履歴なし（毎回単発）。1メッセージあたり最大3回の `generateContent` 呼び出し（structured output試行 → function calling → 再フォーマット）
- Gemini API公式ドキュメント（2026-07時点、Context7経由で確認）: **Gemini 3系は function calling と structured output（responseSchema）の同一リクエスト併用が可能**。GA軽量モデルとして `gemini-3.1-flash-lite` が利用可能。`generateContent` APIは引き続き利用可
- `origin/vercel-deploy` ブランチはPR #5相当で停止した過去の遺物で、本番配信とは無関係

## Decision（決定事項）

### D1. AR表示系は「DOM矩形同期」をやめ「投影行列同期」に切り替える（#36）

- `arjs` に `sourceWidth: 1280; sourceHeight: 960;`（`displayWidth/displayHeight` 含む）を明示し、初期化時点のトラッキング解像度を固定する
- カメラ映像ロード後と `resize` / `orientationchange` 時に、AR.js自身のリサイズ経路（`arToolkitSource.onResizeElement()` / `copyElementSizeTo()`）で video / canvas を同期する
- 画面表示のcoverクロップに合わせて `camera.projectionMatrix` の `[0][0]/[1][1]` 成分をスケール補正し、**トラッキング座標系と描画座標系を数学的に一致**させる
- `syncARLayers()` の500msポーリング・インラインスタイル強制・CSS変数レイヤーハックは撤去する
- 実装の最初のコミットは**計測コード**とする（`?debug=true` で videoWidth/Height・canvas寸法・projectionMatrix成分をログ出力し、根本原因仮説を実機で確認してから修正に入る）

### D2. アバターは「足元アンカー」でマーカーに接地させる（#36）

`vrm-loader.js` の原点合わせを、x/z はbbox中心、y は `box.min.y` 控除に変更し、足元がマーカー面に立つようにする。スケール（現行0.78）は実機で見え方を確認して微調整する。

### D3. キーボードは「継続補正＋markerLost猶予」で安定させる（#37）

- キーボードアクティブ中は**継続rAFループ**で `scrollTo(0, lockedY)` を維持し、残差は `visualViewport.offsetTop/offsetLeft` をARコンテナへ逆平行移動して相殺する
- markerLost に表示猶予を導入する: チャット入力フォーカス中は最終ポーズで表示を継続、通常時は2-3秒のグレース後にフェードアウト。猶予中も感情モーションは再生を続ける（凍結するのはマーカー姿勢のみ）

### D4. チャットUIは「全画面透過オーバーレイ」を維持する（#37）

現行の構造（`z-index: 9999/10000`、半透明バブル + backdrop-filter、背景クリック透過）は正しい設計であり踏襲する。ARの上に半透明でチャット欄を重ねる方式を変更しない。

### D5. Geminiは gemini-3.1-flash-lite（GA）へ更新し、単一呼び出し＋会話履歴＋カメラキャプチャを実装する（#38）

- デフォルトモデルを `gemini-3.1-flash-lite` に変更（`GEMINI_MODEL` 環境変数での上書き設計は維持）
- 非カレンダー会話は `tools` + `responseSchema` 併用の **`generateContent` 1回**に統合（現行の最大3回から削減）
- クライアントが直近10往復を保持しリクエストで送信するマルチターン履歴を導入
- チャットUIに📷（ARカメラの現在フレームをキャプチャ）を追加し、**既存のattachments経路**（`BottomSheet.optimizeImage` → `ChatController` → `api/chat.js` → `buildUserContents`）を再利用する
- 添付UIを 🖼＋📷 の2アクションに再設計し、ライト/ダーク両モードで視認可能にする（discoverability改善）

### D6. トラッキングエンジンは当面AR.jsを継続し、MindARはspike（#39）で評価する

パターンマーカーの構造的限界（KNOWN_ISSUES.md記載の検出距離・角度制約）への中期対策として、名刺全面を画像ターゲット化するMindAR移行を**調査のみ**先行する。音声会話は #40 としてバックログ化する（フェーズ1はWeb Speech APIのTTS）。

## Consequences（結果と影響）

### 良くなること
- 対症療法ループ（同系統PR 9本）から脱出し、描画とトラッキングの整合が原理的に保証される
- `syncARLayers()` 撤去によりコードが大幅に単純化し、500msポーリングのCPU負荷も消える
- Gemini呼び出しが最大1/3になりレイテンシ・コスト削減。会話に文脈が生まれ、カメラ画像認識で「いま見えているもの」を話せる
- 検証プロトコル（ブランチプレビューURL実機確認 → 本番配信物フェッチ確認）が標準化され、「コードがある≠本番で動く」ギャップを塞げる

### 引き受けるリスク・制約
- AR.js 3.4.7はメンテナンスが事実上停止しており、内部API（`arToolkitSource.onResizeElement` 等）の挙動はビルド実体で確認する必要がある（存在・シグネチャが想定と違う場合は同等処理を自前実装）
- markerLost猶予は「見かけ上のトラッキング継続」であり、猶予中はマーカー姿勢が凍結される（製品仕様として許容する）
- 根本原因は実機計測で裏取りしてから修正する手順を必須とする（仮説が外れた場合はIssueにログを添えて再分析）
- 実機検証マトリクス（iOS Safari / Android Chrome × 縦/横 × 距離20/30/40cm × キーボード開閉）を全PRで通す運用コスト

## Alternatives Considered（検討した代替案）

| 代替案 | 判断 | 理由 |
|--------|------|------|
| **DOM矩形同期の継続改良**（現行路線） | ❌ 廃止 | PR #15〜#31で9回近く失敗。投影行列に触れない限りトラッキングと描画の不整合は原理的に解消しない |
| **MindARへ即時移行** | ⏸ spike先行（#39） | 自然特徴トラッキングで検出性能は期待できるが、現行ペンギンロゴ名刺の特徴量で実用になるか未検証。印刷済み名刺資産・コンポーネント書き換えのリスクが大きく、まず比較計測で判断 |
| **WebXR（ネイティブAR API）** | ❌ 却下 | ターゲットのiOS SafariがWebXR ARに非対応（KNOWN_ISSUES.mdの長期案としては継続ウォッチ） |
| **8th Wall等の商用エンジン** | ❌ 却下 | 有償ライセンスがB2B技術デモの規模に対して過剰 |
| **キーボード対策として`interactive-widget=resizes-content`等のmeta依存** | ❌ 単独では不採用 | Android Chromeにしか効かずiOS Safariが無視するため、visualViewport補正の代替にならない（併用は可） |
| **音声会話の一括実装（STT+TTS+リップシンク）** | ⏸ 分割 | クリティカルバグ修正を優先。TTSのみ #40 でバックログ化し、STT/リップシンクは将来フェーズ |

## 実装・検証の進め方

- 実装は Codex CLI（経路B）に委任する。実装指示書: `docs/28_Phase8開発指示書_AR安定化とGemini3.1.md`
- 実装順: #36 → #37 → #38（#38のサーバー部分は並行可）。1 PR = 1 Issue
- 各PRはVercelブランチプレビューURLで実機受入後にマージし、マージ後に本番配信物（`/dist/` 配下）をフェッチして変更到達を確認する

## 参考資料

- `KNOWN_ISSUES.md` — モバイル縦向き検出精度の既知課題
- `docs/17_モバイル最適化_マーカー検出精度向上.md` / `docs/21_緊急_モバイル縦向き検出問題の徹底対策.md` / `docs/22_最終最適化_ベストプラクティス完全実装.md` — 過去のチューニング記録
- Gemini APIモデル一覧・structured output + function calling併用（ai.google.dev、2026-07時点）
