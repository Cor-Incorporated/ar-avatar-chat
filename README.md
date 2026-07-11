# ARアバターチャットプロジェクト

## プロジェクト概要

**Cor.Inc. 技術デモ用ARアプリケーション**

### 目的
- XR関心の高いB2Bパートナーへの技術力誇示
- 名刺マーカー上でのVRMアバター表示 + モーションアニメーション

### ターゲットデバイス
- スマートフォン（iOS Safari 18+ / Android Chrome 120+）
- HTTPS環境必須

### 🌐 本番環境
- **Vercelでデプロイ済み**: https://ar-avatar-chat.vercel.app
- 自動HTTPS対応
- グローバルCDN配信

---

## プロジェクト構成

```
ar-avatar-chat/
├── docs/               # 開発指示書・仕様書
│   ├── 01_開発指示書_Phase1-MVP.md
│   ├── 02_チェックリスト.md
│   └── 03_技術調査結果.md (リサーチャー納品予定)
├── src/                # 開発チームの作業ディレクトリ
│   ├── index.html      # ViteエントリHTML
│   ├── main.ts         # AR・チャットの起動とライフサイクル管理
│   ├── ar/             # ARRuntime / AvatarController / AR専用テスト
│   ├── components/     # チャットUI
│   └── assets/         # 静的ファイル（VRM, マーカー等）
└── assets/             # 外部アセット（VRMモデル、名刺画像等）
```

---

## 開発フェーズ

### Phase 1: MVP ✅ **完了**（2025-10-01）
**担当**: 開発チーム

✅ **実装完了項目**:
1. 環境セットアップ（A-Frame 1.7.0 + AR.js 3.4.7 + three-vrm 3.4.2）
2. カスタムマーカー統合（ペンギンロゴ）
3. VRMアバター表示（18MB）
4. モーションアニメーション再生（VRMA形式 1.3MB）
5. デバッグログ削除・コードリファクタリング完了

**当時の成果物**: Phase 1のA-FrameコンポーネントはPhase 8で廃止され、
現在は`src/ar/ARRuntime.ts`と`src/ar/AvatarController.ts`へ統合されています。
- `src/assets/markers/penguin-marker.patt` - カスタムマーカー
- 詳細: `docs/Phase1_動作確認レポート.md` 参照

### Phase 2: LLM統合 ✅ **完了**（2025-10-04）
**担当**: 開発チーム

✅ **実装完了項目**:
1. Gemini 3.1 Flash-Lite統合
2. チャット機能（博多弁キャラクター「クラウディア」）
3. 感情認識・アニメーション連携
4. Google Calendar API連携（Function Calling）
5. TypeScript化・コードリファクタリング

**成果物**:
- `server/services/gemini.service.ts` - Gemini API統合
- `src/components/BottomSheet.ts` - チャットUI
- `src/controllers/ChatController.ts` - チャット制御
- `server/.env` - API設定ファイル
- 詳細: `docs/Phase2完了報告.md` 参照

### Phase 3: UI改善・TypeScript化 ✅ **完了**（2025-10-04）
**担当**: 開発チーム

✅ **実装完了項目**:
1. フロントエンドTypeScript化
2. モダンUI（BottomSheet）実装
3. アニメーション制御改善（一時的感情→neutral自動復帰）
4. エラーハンドリング強化
5. レスポンシブデザイン対応

### Phase 4: Vercelデプロイ ✅ **完了**（2025-10-05）
**担当**: 開発チーム

✅ **実装完了項目**:
1. Vercel設定（vercel.json, .vercelignore）
2. Serverless Functions（api/chat.js）
3. 環境変数管理（GEMINI_API_KEY）
4. モバイルUI最適化（キーボード対応）
5. 本番環境デプロイ完了

### Phase 5: モバイル最適化・UX改善 ✅ **完了**（2025-10-05）
**担当**: 開発チーム

✅ **実装完了項目**:
1. AR.js検出精度向上（解像度・トラッキング最適化）
2. マーカー平滑化（Smoothing）実装（ジッター50%削減）

### Phase 6: VRMアニメーションリターゲティング実装 ✅ **完了**（2025-10-12）
**担当**: 開発チーム

✅ **実装完了項目**:
1. カスタムVRMAnimationライブラリの統合
2. humanoidボーンマッピングを活用したリターゲティング
3. ボーン命名規則に依存しない柔軟なアニメーションシステム
4. Mixamo/VRM標準/カスタム形式の全対応
5. クリーンアーキテクチャ・ドキュメント充実

**解決した課題**:
- 異なるボーン命名規則（`mixamorig:Hips` vs `J_Bip_C_Hips` vs `l_up_leg`）のVRMAファイルが再生不可
- `THREE.PropertyBinding: No target node found` エラーが50+回発生
- fbx2vrma-converter-uiのカスタム実装を調査・移植して解決

**成果物**:
- `docs/24_VRMアニメーションリターゲティング実装.md` - 詳細ドキュメント（試行錯誤の過程を含む）

**注**: Phase 7で公式パッケージに移行（カスタム実装は削除）

### Phase 7: three-vrm v3.4.2への移行 ✅ **完了**（2025-10-13）
**担当**: 開発チーム

✅ **実装完了項目**:
1. 公式`@pixiv/three-vrm-animation@3.4.2`への完全移行
2. カスタムライブラリ削除（588行削減）
3. 型安全性・エラー検出向上
4. 全機能完全保持（リスクゼロ移行）

**技術的改善**:
- ✅ TypeScript型安全性
- ✅ specVersion検証（1.0, 1.0-draft）
- ✅ T-pose違反の警告
- ✅ 詳細なエラーメッセージ
- ✅ 公式サポート・メンテナンス
- ✅ 最新Three.js v0.177.0対応

**対応ボーン命名規則（Phase 6から継続）**:
- ✅ Mixamo形式（`mixamorig:*`）
- ✅ VRM標準（`J_Bip_C_*`）
- ✅ カスタム形式（`l_*/r_*/torso_*`）
- ✅ 任意の命名規則（VRMC_vrm_animation拡張があれば）

**成果物**:
- `docs/25_three-vrm_バージョン調査結果.md` - バージョン互換性調査
- `docs/27_公式VRMAnimation_互換性確認.md` - アルゴリズム同一性の証明
- `INVESTIGATION_COMPLETE.txt` - 調査完了サマリー

**所要時間**: 2時間（予定2-4時間を短縮）

### Phase 8: AR描画基盤の統合 ✅ **実装完了**（2026-07-11）

- A-FrameとCDN import mapを廃止し、npm/Vite管理へ移行
- AR.js Three.js版、Three.js、three-vrmを単一ランタイムへ統一
- `AR tracking → AnimationMixer/VRM → render`の単一描画ループを実装
- 足ボーン基準配置、等方スケール、cover投影補正を実装
- VRMA資産検証とAR単体テストをビルドゲートへ追加

3. GPU負荷低減（ライティング最適化）
4. **UX改善**: 縦向きデフォルト + 柔軟な横向き提案
5. 連続Lost検出による非侵襲的な警告ダイアログ

**成果物**:
- `docs/17_モバイル最適化_マーカー検出精度向上.md` - 技術最適化
- `docs/18_UX改善_縦向きデフォルト実装.md` - UX設計哲学
- チャットUIとAR精度の両立を実現

**期待される効果**:
- AR検出率: 縦向き85-90%、横向き90-95%
- チャット入力効率: +20-30%向上
- ユーザー離脱率: -15-25%低減
- FPS: 30以上を安定維持

---

## 🚀 起動方法

### 前提条件
- Node.js 18+ インストール済み
- Google Gemini API キー取得済み
- 実機スマートフォン（iOS Safari 18+ / Android Chrome 120+）

### 1. リポジトリクローン
```bash
git clone https://github.com/Cor-Incorporated/ar-avatar-chat.git
cd ar-avatar-chat
```

### 2. サーバー起動
```bash
# サーバーディレクトリに移動
cd server

# 依存関係インストール
npm install

# 環境変数設定（.envファイル作成）
cp .env.example .env
# .envファイルを編集してGEMINI_API_KEYを設定

# サーバー起動
npm run build
npm start
```

### 3. フロントエンド起動
```bash
# プロジェクトルートに戻る
cd ..

# フロントエンド依存関係インストール
npm install

# 本番相当のクライアントビルド
npm run build:client

# ローカルHTTPSまたはVercel Previewでカメラ動作を確認
npx vite --host
```

### 4. アクセス
- ブラウザ: `http://localhost:8000` (フロントエンド)
- API: `http://localhost:3000/api/chat` (バックエンド)

### 5. テスト
1. スマートフォンでHTTPS環境にアクセス
2. カメラ許可
3. ペンギンマーカーを印刷してカメラにかざす
4. VRMアバター表示確認
5. チャット機能テスト

---

## 開発チームへの指示

### 📋 必須ドキュメント
1. **`docs/01_開発指示書_Phase1-MVP.md`** を必ず読むこと
2. **`docs/02_チェックリスト.md`** で進捗管理すること

### ⚠️ 重要な制約
- **想像で実装しない**: `package.json`と現在の実装を正とし、変更理由をIssue/PRへ記録
- **変更前に確認**: 指示書と異なる実装をする場合は、PdM（寺田）に事前報告
- **各ステップで報告**: チェックリスト完了時にスクリーンショット + 動作確認結果を提出

### 🛠 開発環境
- **エディタ**: VS Code推奨
- **ローカルサーバー**: Live Server拡張機能 または `python3 -m http.server 8000`
- **テストデバイス**: 実機スマートフォン（名刺マーカー印刷必須）

---

## リサーチャーとの連携

### 現在進行中の調査
- **調査依頼書 #001**: LLM API選定 + 技術実績調査
- **期限**: 2営業日後
- **成果物**: `docs/03_技術調査結果.md` に納品予定

### 開発チームへの影響
Phase 1はリサーチャーの調査結果に依存しないため、**並行して進めてください**。

---

## 問い合わせ

### PdM（寺田）への報告タイミング
1. **各ステップ完了時**: チェックリスト項目のチェック完了報告
2. **問題発生時**: エラー・動作不良の即時報告（スクリーンショット必須）
3. **変更提案時**: 指示書と異なる実装をしたい場合

### Slack報告フォーマット
```
【Phase 1 進捗報告】
- 完了項目: ステップ1-1（環境セットアップ）
- 動作確認: ✅ カメラ起動確認（iPhone 14 Pro, iOS 18）
- 添付: スクリーンショット.png
- 次のタスク: ステップ1-2（カスタムマーカー生成）
```

---

## 🎯 技術仕様

### フロントエンド
- **AR.js**: 3.4.8（Three.js版）
- **Three.js**: 0.180.0（npm、Viteで単一実体を検証）
- **@pixiv/three-vrm**: 3.5.5
- **@pixiv/three-vrm-animation**: 3.5.5
- **Vite**: 7.3.6
- **TypeScript**: 5.9.3
- **モダンUI**: BottomSheet コンポーネント

### バックエンド
- **Node.js**: 18+
- **Express**: 5.1.0
- **Google Gemini**: 3.1 Flash-Lite
- **TypeScript**: 5.9.3
- **Google Calendar API**: 連携済み

### AI機能
- **キャラクター**: クラウディア（Cor.Inc. AIアンバサダー）
- **言語**: 博多弁
- **感情認識**: 7種類（neutral/happy/angry/sad/relaxed/surprised/thinking）
- **Function Calling**: Google Calendar連携

---

## 🚀 デプロイ情報

### 本番環境（Vercel）
- **URL**: https://ar-avatar-chat.vercel.app
- **プラットフォーム**: Vercel
- **自動デプロイ**: mainブランチへのpush時
- **環境変数**: Vercel Dashboardで管理

### ローカル開発
- フロントエンド: `http://localhost:8000/src/index.html`
- バックエンド: `http://localhost:3000`

---

## バージョン管理

- **初版**: 2025-10-01（PdM 寺田）
- **Phase 2完了**: 2025-10-04（LLM統合）
- **Phase 3完了**: 2025-10-04（UI改善・TypeScript化）
- **Phase 4完了**: 2025-10-05（Vercelデプロイ）
- **Phase 5完了**: 2025-10-05（モバイル最適化・UX改善）
  - AR.js検出精度向上
  - 縦向きデフォルト実装（チャットUIとAR精度の両立）
- **Phase 6完了**: 2025-10-12（VRMアニメーションリターゲティング実装）
  - カスタムVRMAnimationライブラリ統合
  - ボーン命名規則に依存しない柔軟性を実現
- **Phase 7完了**: 2025-10-13（three-vrm v3.4.2への移行）
  - 公式パッケージ完全移行
  - コード削減588行、型安全性向上
  - 全機能完全保持（リスクゼロ移行）
- **更新**: 開発チーム・リサーチャーの成果物追加時に随時更新

---

## 🎨 UX設計哲学

このプロジェクトは**ユーザビリティ第一**の設計を採用しています：

### チャットUIとAR精度の両立
- **縦向きをデフォルト**: チャット入力しやすい自然な持ち方
- **柔軟な提案**: AR検出困難時のみ横向きを提案
- **ユーザー選択を尊重**: 強制ではなく選択肢を提示
- **業界標準に準拠**: Google ARCore / Apple ARKitガイドラインに沿った設計

詳細は `docs/18_UX改善_縦向きデフォルト実装.md` を参照。

---

**🎉 本番稼働中！Cor.Inc.の技術力を示すARアバターチャットアプリケーションがVercelで公開されています！**
