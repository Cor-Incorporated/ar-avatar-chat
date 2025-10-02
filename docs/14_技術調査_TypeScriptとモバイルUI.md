# 技術調査レポート: TypeScript移行とモバイルUI最適化

**調査日**: 2025年10月2日  
**調査者**: 開発チーム  
**目的**: Phase 3実装の技術的妥当性の検証

---

## 📋 調査目的

Phase 2完了後、以下の2つの問題点が指摘されました：

1. **JavaScript実装の限界**: Mastra等のモダンなAIエージェントフレームワークとの統合困難
2. **モバイルUIの問題**: 右側固定のチャットUIがスマホで画面を占有

本調査では、これらの問題に対する技術的な解決策を検証します。

---

## 🔍 調査1: Mastra AIフレームワーク

### Mastraとは

Mastraは、Gatsby.jsの創業者チームが開発したTypeScript専用のAIエージェントフレームワークです。2024年設立、2025年にHacker Newsで急速に人気を獲得し、GitHubスター数が1,500から7,500に増加しました。

### 主要機能

#### 1. エージェントシステム
- LLMが自律的にアクション選択
- ツール、ワークフロー、同期データへのアクセス
- メモリー機能（会話履歴の保存・検索）
- Vercel AI SDK統合（OpenAI、Anthropic、Gemini対応）

#### 2. ツールシステム
```typescript
import { createTool } from '@mastra/core';
import { z } from 'zod';

export const weatherTool = createTool({
  id: 'get-weather',
  description: '指定された場所の現在の天気を取得',
  inputSchema: z.object({
    location: z.string().describe('都市名')
  }),
  outputSchema: z.object({
    temperature: z.number(),
    condition: z.string()
  }),
  execute: async ({ context }) => {
    const { location } = context;
    const weather = await fetchWeather(location);
    return weather;
  }
});
```

#### 3. ワークフロー
- グラフベースのステートマシン
- ループ、分岐、人間の入力待ち
- エラーハンドリング、リトライ
- OpenTelemetryトレーシング内蔵

#### 4. RAG（Retrieval-Augmented Generation）
- ドキュメント処理（テキスト、HTML、Markdown、JSON）
- チャンキング、埋め込み、ベクトル検索
- 複数のベクトルストア対応（Pinecone、pgvector等）

#### 5. 評価システム
- モデルベース評価
- ルールベース評価
- 統計的評価
- 毒性、バイアス、関連性、事実精度の測定

### 現在のプロジェクトへの適用

#### Before (現在のアーキテクチャ)
```
User → Express API → Gemini API (直接呼び出し)
                    ↓
                 手動で感情検出
                    ↓
                 VRMアニメーション
```

#### After (Mastra統合後)
```
User → Mastra Agent → ツール実行
                    ├─ Gemini API (Vercel AI SDK経由)
                    ├─ Google Calendar Tool
                    ├─ Emotion Detection Tool
                    └─ Memory Store
                    ↓
                 VRMアニメーション
```

### 統合のメリット

1. **型安全性**: TypeScriptによる自動補完とエラーチェック
2. **メモリー管理**: 会話履歴の自動保存・検索（意味検索対応）
3. **ツール管理**: 統一されたツールインターフェース
4. **観測性**: すべての処理をOpenTelemetryでトレース
5. **評価**: LLM出力の品質を自動評価
6. **デプロイ**: Vercel/Cloudflare Workersへの簡単デプロイ
7. **拡張性**: 将来的なRAG統合、複雑なワークフローに対応

### 実装例

```typescript
// server/mastra/agents/avatar-agent.ts
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { gemini } from '@ai-sdk/google';

export const avatarAgent = new Agent({
  name: 'VRM Avatar Agent',
  instructions: `
あなたは博多弁で話すVRoidキャラクターです。
感情（neutral/happy/angry/sad/relaxed/surprised/thinking）を
適切に使い分けてください。
  `,
  model: gemini('gemini-2.5-flash'),
  tools: {
    calendarTool,
    emotionTool
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:./mastra.db',
    }),
  }),
});

// server/mastra/index.ts
import { Mastra } from '@mastra/core/mastra';
import { avatarAgent } from './agents/avatar-agent';

export const mastra = new Mastra({
  agents: { avatarAgent },
  logger: new PinoLogger({ name: 'AR Avatar', level: 'info' }),
});

// APIエンドポイント
app.post('/api/chat', async (req, res) => {
  const agent = await mastra.getAgent('avatarAgent');
  const result = await agent.generate(req.body.message);
  
  res.json({
    message: result.text,
    emotion: result.metadata.emotion
  });
});
```

### 学習曲線

- **初級**: 基本的なエージェント作成（1日）
- **中級**: ツールとワークフロー（3-5日）
- **上級**: RAG、評価、カスタム統合（1-2週間）

公式ドキュメント、コミュニティサポート、豊富なサンプルコードが利用可能。

---

## 🔍 調査2: モバイルUIベストプラクティス

### ボトムシート（Bottom Sheet）とは

ボトムシートは、画面下部に固定され、ユーザーの操作に応じて展開・折りたたみできるUIコンポーネントです。

### 種類

#### 1. モーダルボトムシート
- 背景オーバーレイあり
- 他のUI要素への操作をブロック
- 重要なアクションや集中が必要なタスクに使用

#### 2. ノンモーダルボトムシート
- 背景が見える（透明度調整可能）
- 他のUI要素への操作が可能
- AR/VRアプリに最適
- Google Mapsなどで一般的

### AR/VRアプリでの推奨設計

#### 1. 段階的展開（3段階）

**折りたたみ（Collapsed）:**
- 高さ: 80-120px
- 表示: 入力欄のみ
- 用途: ARコンテンツに集中

**プレビュー（Peek）:**
- 高さ: 200-300px
- 表示: 直近2-3メッセージ + 入力欄
- 用途: 通常の会話

**展開（Expanded）:**
- 高さ: 画面の60-70%
- 表示: 履歴10メッセージ + 入力欄
- 用途: 長い会話の確認

#### 2. ジェスチャー操作

**必須サポート:**
- ドラッグハンドル（視覚的インジケーター）
- 上下スワイプでの展開・折りたたみ
- タップでの状態切り替え
- 背景タップでの折りたたみ（オプション）

**スナップポイント:**
- 3段階の高さに自動スナップ
- スムーズなアニメーション（300ms）
- イージング: cubic-bezier(0.4, 0, 0.2, 1)

#### 3. レスポンシブ対応

**縦画面（Portrait）:**
- 標準のボトムシート動作
- 全画面の60%まで展開可能

**横画面（Landscape）:**
- 高さを抑える（画面の40%まで）
- より多くのAR領域を確保
- 横スクロール検討

**タブレット:**
- より広い表示領域
- 分割ビュー検討（AR + チャット並列）

### 既存UIとの比較

#### 現在の右側固定方式
```
┌──────────┬───────┐
│          │       │
│  AR View │ Chat  │
│          │  UI   │
│          │       │
└──────────┴───────┘
```

**問題点:**
- スマホでチャットが画面の30-40%を占有
- ARコンテンツとVRMが見えにくい
- 横画面でさらに問題が顕著

#### 提案するボトムシート方式
```
┌─────────────────┐
│                 │
│    AR View      │  ← ARとVRMが常に見える
│                 │
├─────────────────┤
│  💬 Chat (折畳) │  ← 必要時のみ展開
└─────────────────┘
```

**改善点:**
- AR領域が最大化される
- 必要時のみチャットを展開
- 背景が透けて見える

### 実装のポイント

#### 1. パフォーマンス
```css
.bottom-sheet {
  /* GPUアクセラレーション */
  transform: translateZ(0);
  will-change: height;
  
  /* スムーズなアニメーション */
  transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.messages-preview {
  /* スムーズなスクロール */
  -webkit-overflow-scrolling: touch;
  overflow-y: auto;
}
```

#### 2. アクセシビリティ
- キーボードナビゲーション対応
- スクリーンリーダー対応
- 高コントラストモード対応
- 十分なタップターゲットサイズ（44x44px以上）

#### 3. モバイル固有の配慮
- セーフエリア（ノッチ、ホームインジケーター）を考慮
- iOS Safari のバウンススクロール対策
- Android のシステムジェスチャーとの競合回避

### 類似実装の事例

#### 1. Google Maps
- ノンモーダルボトムシート
- 地図が常に見える
- ドラッグで3段階展開

#### 2. Spotify
- ミニプレイヤー（折りたたみ）
- ドラッグで全画面展開
- 背景がぼける

#### 3. Apple Music
- Now Playing シート
- スワイプジェスチャー
- スムーズなアニメーション

### UIライブラリの選択

#### オプション1: カスタム実装（推奨）
**メリット:**
- 完全なカスタマイズ可能
- 軽量（依存なし）
- AR/VRM統合が容易

**デメリット:**
- 実装工数が必要
- バグ修正が自前

#### オプション2: Material UI Bottom Sheet
**メリット:**
- 実装済み、テスト済み
- アクセシビリティ対応

**デメリット:**
- 重い（Material UI全体が必要）
- カスタマイズに制約

#### オプション3: React Spring Bottom Sheet
**メリット:**
- 軽量
- 滑らかなアニメーション

**デメリト:**
- React依存
- Three.jsとの統合に工夫が必要

**結論**: カスタム実装を推奨。TypeScriptで200行程度で実装可能。

---

## 🔍 調査3: TypeScript移行

### Three.jsとTypeScriptの互換性

#### 公式サポート
- Three.js は TypeScript 型定義を公式提供（`@types/three`）
- A-Frame も型定義あり（`@types/aframe`）
- `@pixiv/three-vrm` も TypeScript で記述

#### WebXR API
- TypeScript対応
- `@types/webxr` パッケージで型定義利用可能

### 移行戦略

#### 1. 段階的移行（推奨）
```
Week 1: 型定義ファイル作成
Week 2: バックエンド移行
Week 3: フロントエンド移行
Week 4: テストとバグ修正
```

#### 2. ビッグバン移行
- リスクが高い
- 推奨しない

### 型定義の例

```typescript
// src/types/vrm.types.ts
import type { VRM } from '@pixiv/three-vrm';
import type { Scene } from 'three';

export interface VRMLoadedEvent {
  vrm: VRM;
  scene: Scene;
}

export type EmotionType = 
  | 'neutral'
  | 'happy'
  | 'angry'
  | 'sad'
  | 'relaxed'
  | 'surprised'
  | 'thinking';

export interface EmotionMapping {
  [key: EmotionType]: string; // アニメーションファイルパス
}

// src/types/chat.types.ts
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  emotion?: EmotionType;
}

export interface ChatResponse {
  message: string;
  emotion: EmotionType;
}

export interface ChatRequest {
  message: string;
  oauthToken?: string;
}
```

### ビルドシステム

#### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "WebWorker"],
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*", "server/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### ビルドコマンド
```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "type-check": "tsc --noEmit"
  }
}
```

---

## 📊 比較表

### JavaScript vs TypeScript

| 項目 | JavaScript | TypeScript |
|------|-----------|-----------|
| 型安全性 | ❌ なし | ✅ 強い |
| IDE補完 | △ 弱い | ✅ 強力 |
| リファクタリング | △ 危険 | ✅ 安全 |
| バグ検出 | 実行時 | コンパイル時 |
| Mastra統合 | ❌ 不可 | ✅ ネイティブ |
| 学習曲線 | 低い | 中程度 |
| ビルド時間 | 0秒 | 5-30秒 |

### 右側UI vs ボトムシート

| 項目 | 右側固定 | ボトムシート |
|------|---------|------------|
| スマホでのAR表示 | ❌ 60%のみ | ✅ 90%以上 |
| 没入感 | ❌ 低い | ✅ 高い |
| チャット操作性 | ✅ 良い | ✅ 良い |
| 横画面対応 | ❌ 悪い | ✅ 良い |
| タブレット | △ 普通 | ✅ 良い |
| 実装工数 | 低い | 中程度 |

---

## 🎯 推奨事項

### 1. TypeScript移行: 強く推奨 ✅
**理由:**
- Mastra統合に必須
- 将来的なスケーラビリティ
- バグ削減効果
- チーム開発の生産性向上

**リスク:** 低  
**工数:** 2週間  
**ROI:** 高

### 2. Mastra統合: 強く推奨 ✅
**理由:**
- モダンなAIエージェント機能
- メモリー、RAG、評価システム
- 観測性とデバッグ容易性
- 将来の機能拡張に対応

**リスク:** 中（学習コスト）  
**工数:** 1-2週間  
**ROI:** 非常に高

### 3. ボトムシートUI: 強く推奨 ✅
**理由:**
- モバイル体験の大幅改善
- ARの没入感向上
- 業界標準パターン
- アクセシビリティ向上

**リスク:** 低  
**工数:** 1.5週間  
**ROI:** 高

---

## 📅 実装優先度

### Phase 3A (最優先): TypeScript移行 + ボトムシートUI
- **期間**: 3週間
- **理由**: ユーザー体験の即座の改善
- **成果**: モバイルユーザビリティ90点以上

### Phase 3B: Mastra統合
- **期間**: 1-2週間
- **理由**: 基盤が整った後に実施
- **成果**: 将来的な機能拡張の準備

---

## 💬 結論

調査の結果、以下の結論に至りました：

1. **TypeScript移行は必須**: Mastra統合、型安全性、将来の拡張性のため
2. **ボトムシートUIは最優先**: モバイルユーザー体験の大幅改善
3. **Mastra統合は推奨**: モダンなAIエージェント機能、長期的なROI

Phase 3として、これらすべてを実装することを強く推奨します。

---

**調査日**: 2025年10月2日  
**調査者**: 開発チーム  
**次のアクション**: PdMへの提案書提出
