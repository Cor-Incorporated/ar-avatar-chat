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
│   ├── index.html      # メインHTML
│   ├── components/     # A-Frameカスタムコンポーネント
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

**成果物**:
- `src/index.html` - メインアプリケーション
- `src/components/vrm-loader.js` - VRMローダーコンポーネント
- `src/components/vrm-animation.js` - アニメーションコンポーネント
- `src/assets/markers/penguin-marker.patt` - カスタムマーカー
- 詳細: `docs/Phase1_動作確認レポート.md` 参照

### Phase 2: LLM統合 ✅ **完了**（2025-10-04）
**担当**: 開発チーム

✅ **実装完了項目**:
1. Gemini 2.5 Flash統合
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

# 開発サーバー起動
npm run dev
# または
python3 -m http.server 8000
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
- **想像で実装しない**: 指示書に記載のコード例・CDNバージョンを厳守
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
- **A-Frame**: 1.7.0
- **AR.js**: 3.4.7  
- **Three.js**: VRM 3.4.2
- **TypeScript**: 5.9.3
- **モダンUI**: BottomSheet コンポーネント

### バックエンド
- **Node.js**: 18+
- **Express**: 5.1.0
- **Google Gemini**: 2.5 Flash
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
- **更新**: 開発チーム・リサーチャーの成果物追加時に随時更新

---

**🎉 本番稼働中！Cor.Inc.の技術力を示すARアバターチャットアプリケーションがVercelで公開されています！**
