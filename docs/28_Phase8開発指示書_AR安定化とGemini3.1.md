# Handover: Phase 8 — AR表示安定化・チャット透過オーバーレイ・Gemini 3.1 GA化

**作成日**: 2026-07-10 / **作成者**: Claude Code / **宛先**: Codex CLI（経路B）

## 作業環境

- **Repo**: `/Users/teradakousuke/Developer/ar-avatar-chat`（GitHub: `Cor-Incorporated/ar-avatar-chat`）
- **Base branch**: `main`（起点コミット 6a31a21、dev と同一内容）
- **Worktree**: 新規作成が必要 — 規約パス `<repo>/.worktrees/codex/<branch-slug>`（`~/.codex/AGENTS.md` 準拠）
- **現況**: clean / 直近コミット `6a31a21 Promote emotion motion and avatar scale fix`
- **本番**: https://ar-avatar-chat.vercel.app（main へのpushで自動デプロイ。全ブランチにプレビューURL `ar-avatar-chat-git-<branch>-….vercel.app` が発行される）

## 目的（1〜2行）

モバイル実機でマーカー上に正しいプロポーション・位置でアバターを表示し、キーボード表示中も半透明チャット越しにアバターの挙動が見え続ける状態にする。あわせてGeminiを `gemini-3.1-flash-lite`（GA）へ更新し、会話履歴とカメラ画像認識を有効化する。

## 経緯（判断済み事項と根拠）

- PR #15/#17/#19/#21/#23/#25/#27/#29/#31 でDOM矩形同期の対症療法が繰り返され根治せず（git log裏取り済み）
- 根本原因3点をコード調査で特定し、**設計判断を ADR-001（`docs/adr/001-ar-viewport-projection-and-chat-overlay.md`）に記録済み**。着手前に必ず読むこと
- 実装対象は Issue **#36 → #37 → #38**（この順。#38のサーバー部分のみ先行並行可）。#39（MindAR spike）/#40（TTS）はバックログで**本依頼のスコープ外**
- Gemini 3系の tools + responseSchema 併用可、`gemini-3.1-flash-lite` GA提供は公式ドキュメントで確認済み（2026-07）
- 本番がmain追従・プレビューURL運用であることはVercel APIで確認済み

## タスク（番号付き・完了条件つき）

1. **Issue #36: AR投影行列同期と足元アンカー**
   - 最初のコミットは計測コード（`?debug=true` で `videoWidth/videoHeight`・canvas実寸・`camera.projectionMatrix` 成分をログ出力）とし、ADR-001の根本原因仮説を実機ログで裏取りする
   - `arjs` 設定に `sourceWidth: 1280; sourceHeight: 960; displayWidth/displayHeight` を明示（`src/index.html:183`）
   - resize/orientationchange 時に AR.js のリサイズ経路で video/canvas を同期し、coverクロップ比で `projectionMatrix[0][0]/[1][1]` を補正
   - `syncARLayers()`（`src/index.html:245-511`）の500msポーリングとインラインスタイル強制を撤去
   - `src/components/vrm-loader.js:39-45` を x/z=bbox中心・y=`box.min.y` 控除の足元アンカーへ変更
   - **完了条件**: Issue #36 の受入基準チェックボックス全項目を、プレビューURL実機（iOS Safari/Android Chrome、縦/横）で確認しエビデンス（スクリーンショット/ログ）をPRに添付
2. **Issue #37: キーボード継続補正とmarkerLost猶予**
   - キーボードアクティブ中の継続rAFスクロールロック + `visualViewport.offsetTop/offsetLeft` 逆補正（`src/components/BottomSheet.ts` 拡張）
   - markerLost猶予（チャットフォーカス中は無期限、通常時2-3秒）でアバターのポーズ凍結表示（`src/index.html` のmarkerFound/markerLostハンドラ拡張）
   - チャットUIの透過オーバーレイ構造（z-index/半透明CSS）は変更しない
   - **完了条件**: Issue #37 の受入基準全項目を実機で確認（キーボード開閉の画面録画をエビデンスに）
3. **Issue #38: Gemini 3.1 GA化・単一呼び出し・履歴・カメラキャプチャ・添付UX**
   - `server/services/gemini.service.ts:87` のデフォルトを `gemini-3.1-flash-lite` へ、`handleFunctionCalling`（`:258-405`）を tools+responseSchema 併用の単一呼び出しに再構成
   - 直近10往復のクライアント保持履歴を `contents` に展開（`src/types/chat.types.ts` と `server/types/chat.types.ts` の両リクエスト型を同期更新）
   - 📷カメラキャプチャ（`#arjs-video` → canvas → JPEG）を追加し**既存attachments経路を再利用**、添付UIを🖼＋📷の2アクションに再設計
   - `.env.example` 新設（`GEMINI_API_KEY` / `GEMINI_MODEL` / `PORT`）、CLAUDE.md・READMEのモデル表記を実装に同期
   - **完了条件**: Issue #38 の受入基準全項目（単一呼び出しはサーバーログ、履歴・カメラは実機、マージ後は本番配信物フェッチ）

**運用**: 1 Issue = 1ブランチ（`codex/<slug>`）= 1 PR。PR本文に `Closes #<番号>` と実機エビデンスを含める。PRマージとIssueクローズの最終判断はユーザーが行う。

## 所有範囲

- **触ってよい**: `src/**`（index.html, components/, controllers/, styles/, types/）、`server/**`、`api/**`、`.env.example`（新規）、`CLAUDE.md`/`README.md`（モデル表記の同期のみ）、`package.json`（必要時）
- **禁止**:
  - `docs/**` の書き換え（ADR-001と本書は読み取り専用。調査報告の追加は可）
  - `.github/workflows/**` の変更
  - `main`/`dev` への直接push、PRの自己マージ、Issueのクローズ
  - `src/assets/**` のバイナリ差し替え
  - `origin/vercel-deploy` ブランチの参照・rebase（PR #5相当で停止した遺物。削除はユーザー判断）
  - 認証情報のコミット（`GEMINI_API_KEY` はVercel環境変数と `.env`（gitignore済み）のみ）

## 完了時の報告形式

各PRごとに: 変更ファイル一覧 / commit hash / 実行テスト（`npm run type-check` 結果、実機検証マトリクスの結果表、プレビューURL、エビデンスのスクリーンショット・録画・ログ）/ 残リスク。evidence-report の6段階（未着手/実装済み/ビルド通過/ローカル検証/プレビュー実機検証/本番検証）で状態を明記すること。

### 実機検証マトリクス（#36/#37の必須項目）

| 軸 | 値 |
|----|----|
| デバイス | iOS Safari 18+ / Android Chrome 120+ |
| 向き | 縦 / 横 |
| マーカー距離 | 20cm / 30cm / 40cm |
| キーボード | 閉 / 開（#37） |
| 計測 | `?debug=true` でfps（30以上）とマーカー姿勢ログ |

### デプロイ検証プロトコル（全PR共通・必須）

1. PR作成後、Vercelプレビュー URL（`ar-avatar-chat-git-<branch>-….vercel.app`）を実機で開いて受入基準を確認**してから**マージ依頼
2. マージ後、本番の配信物（例: `https://ar-avatar-chat.vercel.app/dist/src/components/BottomSheet.js`）をフェッチし、変更コードの到達を確認
3. 「コードがある ≠ 本番で見える/動く」— 到達確認までを完了と呼ぶ

## 絶対遵守ルール

サブエージェントを最大展開して自律開発してください。
各サブエージェントには高負荷の調査・設計・実装・テスト・レビューを担当させてください。サブエージェントを検索エンジンとして使わないでください。
常に稼働管理を徹底して、サブエージェントを「起動した数」ではなく「未完了タスクを持って稼働している数」で管理してください。
完了・停止しているものには即座に次タスクを投げ続けて常に稼働させてください。

## ハマりポイント・注意（過去の失敗を含む）

- **AR.js 3.4.7はメンテ停止気味**。内部API（`arToolkitSource.onResizeElement` / `copyElementSizeTo` / `arController.getCameraMatrix` 等）は raw.githack 配信の `aframe-ar.js` ビルド実体で存在とシグネチャを確認してから使う。想定と違う場合は同等処理を自前実装し、その旨をPRに記録
- **修正前に実機計測で仮説裏取り**が必須（ADR-001の運用）。仮説が外れた場合は修正に進まず、ログを添えてIssueで再分析
- **iOSのvisualViewportはフォーカス中に連続変化**する。単発rAF復元では追従できない（PR #31の轍）。継続ループ＋オフセット補正で対処
- `syncARLayers()` の撤去は一括で行わず、計測コミット → 置換コミット → 撤去コミットに分割し、各段階でプレビューURL実機確認
- **ローカル開発の罠**: `src/index.html` は `/dist/src/**` の compiled JS を読む。`python3 -m http.server` を `src/` から起動すると `/dist` が解決できない。`npm run build` 後にリポジトリルートから配信するか、Vercelプレビューで検証する
- 会話履歴の追加では `api/chat.js`（Vercel関数）と `server/index.ts`（ローカルExpress）の**両方**のリクエスト処理を更新し、`chat.types.ts`（src/server両方）の型を一致させる
- Gemini の tools + responseSchema 併用は**Gemini 3系のみ**の機能。`@google/genai ^1.52.0` での動作をローカルで確認してから組み込む
- 感情モーション経路（Gemini応答 `emotion` → `window.playEmotion` → VRMA再生）は既存のまま**変更禁止**（`src/components/vrm-animation-controller.js`）
- コミットは `<type>: <description>` 形式（feat/fix/refactor/docs/test/chore/perf/ci）。1コミット1意図

## 起動プロンプト（ユーザーがCodexに貼る用）

```
/Users/teradakousuke/Developer/ar-avatar-chat の docs/28_Phase8開発指示書_AR安定化とGemini3.1.md と docs/adr/001-ar-viewport-projection-and-chat-overlay.md を読み、Issue #36 から順に実装してください。1 Issue = 1ブランチ（codex/<slug>）= 1 PR、実機検証エビデンス添付、マージ判断はユーザーに委ねること。
```
