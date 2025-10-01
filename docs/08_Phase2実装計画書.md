# Phase 2 実装計画書
## LLM統合 - Gemini 2.5 Flash + Google Calendar連携

**発行日**: 2025-10-01  
**発行者**: PdM 寺田康佑  
**前提条件**: Phase 1完了、Tier 2 APIキー保有済み  
**期限**: Phase 1完了後 4営業日

---

## 🎯 Phase 2の目標

Phase 1で完成したARアバター体験に、AI会話機能を統合します。

### 実装機能
1. **Gemini 2.5 Flash統合**: 自然な日本語会話
2. **Google Calendar連携**: 「明日の予定は？」などの質問に対応
3. **VRoidキャラクター口調**: システムプロンプトで一貫性維持
4. **セキュアなプロキシ**: APIキー保護 + OAuth 2.0認証

---

## 📊 リサーチャー検証結果の評価

### ✅ 検証成功項目
| 項目 | 目標 | 結果 | 評価 |
|------|------|------|------|
| Function Calling精度 | 高精度 | 10/10成功（日本語） | ✅ 達成 |
| 応答速度 | <2秒 | 1.85秒 | ✅ 達成 |
| トークン生成速度 | >500 tokens/s | 650 tokens/s | ✅ 達成 |
| VRoid口調維持 | 一貫性 | 4.5/5.0 | ✅ 達成 |

### ⚠️ 注意項目
| 項目 | 課題 | 対策 |
|------|------|------|
| 複合タスク安定性 | 8/10成功 | プロンプトエンジニアリング強化 |
| レート制限 | Tier 1では不足 | **Tier 2保有済み（解消済み）✅** |

---

## 🏗️ Phase 2アーキテクチャ

### システム構成図
```
┌─────────────────┐
│  Client         │ (A-Frame AR環境)
│  - AR表示       │
│  - チャットUI   │
│  - OAuth Token  │
└────────┬────────┘
         │ HTTPS
         │ Authorization: Bearer <OAuth Token>
         ↓
┌─────────────────┐
│  Proxy Server   │ (Node.js Express)
│  - CORS対応     │
│  - Function     │
│    Calling管理  │
│  - 環境変数で   │
│    APIキー管理  │
└────────┬────────┘
         │
    ┌────┴────┐
    ↓         ↓
┌────────┐ ┌──────────┐
│ Gemini │ │ Google   │
│ 2.5    │ │ Calendar │
│ Flash  │ │ API      │
└────────┘ └──────────┘
```

### 非対称認証スキーム
1. **Gemini API認証**: サーバー側のAPIキー（環境変数 `GEMINI_API_KEY`）
2. **Calendar API認証**: ユーザーのOAuthトークン（クライアントから転送）

---

## 📋 実装スコープ

### Phase 2-A: コア機能（必須）
**期間**: 2営業日

1. **プロキシサーバー構築**
   - Node.js Express セットアップ
   - CORS設定
   - 環境変数管理（.envファイル）

2. **Gemini API統合**
   - @google/genai SDK導入
   - Function Calling実装
   - システムプロンプト設定（VRoid口調）

3. **Google Calendar連携**
   - OAuth 2.0 Web Serverフロー実装
   - Calendar API呼び出し
   - Function Calling処理ループ

4. **クライアント統合**
   - AR環境にチャットUI追加
   - プロキシサーバーへのFetch実装
   - OAuthトークン取得フロー

### Phase 2-B: 拡張機能（オプション）
**期間**: 2営業日（Phase 2-A完了後）

1. **TTS + リップシンク**（元々の要件）
   - ElevenLabs TTS統合
   - VRM表情制御（VRMExpressionManager）

2. **音声入力**
   - Web Speech Recognition統合

3. **追加ツール**
   - Web検索統合（Google Search API）

---

## 🔐 セキュリティ要件（必須）

### 1. APIキー管理
```bash
# .env ファイル（サーバーサイドのみ）
GEMINI_API_KEY=your_tier2_api_key_here
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
```

**重要**: `.env`ファイルを`.gitignore`に追加

### 2. OAuth 2.0フロー
- **スコープ**: `https://www.googleapis.com/auth/calendar.readonly`
- **リダイレクトURI**: `http://localhost:3000/oauth2callback`（開発）
- **本番**: HTTPS必須

### 3. CORS設定
開発環境では`Access-Control-Allow-Origin: *`、本番環境では特定ドメインのみ許可

---

## 🎯 Phase 2成功基準

### 技術要件
- [ ] チャット入力 → Gemini応答が2秒未満
- [ ] 「明日の予定は？」でCalendar連携が動作
- [ ] VRoid口調が維持される
- [ ] エラーハンドリングが実装されている

### パフォーマンス要件
- [ ] Tier 2レート制限内で安定動作
- [ ] Function Calling成功率 >90%
- [ ] OAuth認証フローが完了する

### セキュリティ要件
- [ ] APIキーがクライアントに露出しない
- [ ] OAuthトークンが安全に管理される
- [ ] HTTPSでデプロイされている

---

## 📅 実装スケジュール

### 前提条件
- ✅ Phase 1完了（ARマーカー + VRMアバター + モーション）
- ✅ Tier 2 APIキー取得済み
- ✅ リサーチャー実装ガイド完成

### タイムライン
```
Day 1-2: プロキシサーバー + Gemini統合
  - 環境セットアップ
  - Function Calling実装
  - Google Calendar API連携

Day 3: クライアント統合
  - チャットUI追加
  - OAuth認証フロー
  - エンドツーエンドテスト

Day 4: テスト + デバッグ
  - 実機テスト
  - エラーハンドリング
  - パフォーマンス確認
```

---

## 🚧 リスク管理

### 技術リスク
| リスク | 影響度 | 対策 | ステータス |
|-------|--------|------|----------|
| Function Calling不安定 | 中 | プロンプトエンジニアリング | ✅ 対策済み |
| OAuth認証の複雑性 | 中 | リサーチャーのコード使用 | ✅ 解決済み |
| レート制限 | 高 | Tier 2使用 | ✅ 解決済み |
| CORS問題 | 低 | プロキシサーバー設計 | ✅ 設計済み |

### スケジュールリスク
- OAuth認証テストに時間がかかる可能性 → 1日バッファを確保

---

## 📦 Phase 2完了時の成果物

### コード
```
ar-avatar-chat/
├── server/                      # 新規追加
│   ├── package.json
│   ├── .env.example
│   ├── proxy-server.js          # メインサーバー
│   ├── google-calendar-integration.js
│   └── oauth-handler.js
├── src/
│   ├── index.html               # チャットUI追加
│   ├── components/
│   │   ├── vrm-loader.js
│   │   ├── vrm-animation.js
│   │   └── chat-handler.js      # 新規追加
│   └── assets/ (既存)
└── docs/
    ├── 09_Phase2開発指示書.md    # 新規作成
    └── 10_OAuth認証手順.md       # 新規作成
```

### ドキュメント
1. **Phase 2開発指示書**（詳細な実装手順）
2. **OAuth認証セットアップガイド**
3. **動作確認レポート**

---

## 🎉 Phase 2完了後の状態

### 実現される体験
1. ユーザーが名刺マーカーにスマホをかざす
2. VRMアバターが登場してアニメーション
3. チャット入力フィールドが表示
4. 「明日の予定は？」と入力
5. Geminiが Calendar APIで予定を取得
6. アバターが「明日は〇〇の会議があるのですね！」と応答
7. VRoid風の口調で自然な会話が続く

---

## 📞 次のステップ

### PdMタスク
1. Phase 2開発指示書の作成（詳細版）
2. OAuth認証セットアップガイドの作成
3. 開発チームへの説明会（Phase 1完了後）

### 開発チームタスク（Phase 1完了後）
1. Phase 2開発指示書の確認
2. プロキシサーバーのセットアップ
3. Gemini統合の実装

---

**最終更新**: 2025-10-01 by PdM 寺田康佑
