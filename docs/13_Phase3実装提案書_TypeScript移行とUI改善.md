# Phase 3 実装提案書: TypeScript移行 + UI改善

**作成日**: 2025年10月2日  
**作成者**: 開発チーム  
**対象**: PdM  
**Phase**: Phase 3 - TypeScript移行 + モバイルUI改善 + Mastra統合

---

## 📊 現状分析

### Phase 2 完了状況
- ✅ Gemini API統合（Structured Output方式）
- ✅ チャットUI（右側固定方式）
- ✅ VRMアニメーション制御
- ✅ 博多弁キャラクター実装

### 確認された問題点

#### 1. JavaScript実装の限界
**問題:**
- すべてのコードがJavaScriptで書かれている
- 型安全性がなく、バグの早期発見が困難
- MastraなどモダンなAIエージェントフレームワークと統合できない
- スケーラビリティに欠ける

**影響:**
- 将来的な機能追加（RAG、複雑なエージェントワークフロー）が困難
- コードのメンテナンス性が低い
- チーム開発時の型情報共有が不可能

#### 2. モバイルUIの問題
**問題:**
- 右側固定のチャットUIがスマホで画面を占有
- ARコンテンツとVRMキャラクターが見えにくい
- タブレット横画面でも同様の問題が発生

**影響:**
- モバイルユーザーエクスペリエンスが低下
- ARの没入感が損なわれる
- 主要なターゲットデバイス（スマホ）での利用体験が悪い

---

## 🎯 Phase 3 目標

### 主要目標
1. **TypeScript化**: 全コードベースをTypeScriptに移行
2. **Mastra統合**: AIエージェントフレームワークの統合
3. **UI改善**: ボトムシート方式への移行
4. **モバイル最適化**: スマホ・タブレットでの快適な利用

### 副次的目標
- コードの型安全性向上
- 開発体験（DX）の改善
- 将来的な機能拡張への基盤構築
- デプロイの簡素化

---

## 📐 技術提案

### 1. TypeScript移行戦略

#### ステップ1: 環境構築
```bash
# TypeScript関連パッケージのインストール
npm install --save-dev typescript @types/node @types/three
npm install --save-dev @types/aframe @types/express

# tsconfig.json作成
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

#### ステップ2: 段階的移行
1. **Week 1**: 型定義ファイル作成（`.d.ts`）
2. **Week 2**: バックエンド移行（`server/`）
3. **Week 3**: フロントエンド移行（`src/`）
4. **Week 4**: テストとバグ修正

#### 移行ファイルリスト
**バックエンド:**
- `server/index.js` → `server/index.ts`
- `server/google-calendar-integration.js` → `server/services/gemini.service.ts`
- 新規: `server/types/chat.types.ts`
- 新規: `server/types/emotion.types.ts`

**フロントエンド:**
- `src/components/chat-ui.js` → `src/components/ChatUI.ts`
- `src/components/vrm-animation-controller.js` → `src/components/VRMAnimationController.ts`
- `src/controllers/chat-controller.js` → `src/controllers/ChatController.ts`
- 新規: `src/types/vrm.types.ts`
- 新規: `src/types/chat.types.ts`

---

### 2. Mastra統合

#### アーキテクチャ設計

```
ar-avatar-chat/
├── server/
│   ├── mastra/
│   │   ├── index.ts           # Mastraインスタンス
│   │   ├── agents/
│   │   │   └── avatar-agent.ts    # VRMアバターエージェント
│   │   ├── tools/
│   │   │   ├── calendar.tool.ts   # Googleカレンダー
│   │   │   └── emotion.tool.ts    # 感情検出
│   │   ├── workflows/
│   │   │   └── conversation.workflow.ts
│   │   └── stores/
│   │       └── memory.store.ts
│   ├── api/
│   │   └── routes.ts
│   └── types/
└── src/
    └── (フロントエンド)
```

#### Mastra実装例

**`server/mastra/agents/avatar-agent.ts`:**
```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { gemini } from '@ai-sdk/google';
import { calendarTool } from '../tools/calendar.tool';
import { emotionTool } from '../tools/emotion.tool';

export const avatarAgent = new Agent({
  name: 'VRM Avatar Agent',
  instructions: `
あなたは博多弁で話すVRoidキャラクターです。
以下のルールに従って会話してください：

【口調ルール】
- 語尾: 「〜ばい」「〜やけん」「〜と？」
- 一人称: 「うち」
- 性格: 明るく、親しみやすい

【感情表現】
- neutral, happy, angry, sad, relaxed, surprised, thinking
の7種類の感情を適切に使い分けてください。
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
```

**`server/mastra/tools/emotion.tool.ts`:**
```typescript
import { createTool } from '@mastra/core';
import { z } from 'zod';

export const emotionTool = createTool({
  id: 'detect-emotion',
  description: 'メッセージから感情を検出してVRMアニメーションを制御',
  inputSchema: z.object({
    message: z.string().describe('応答メッセージ'),
    context: z.string().optional().describe('会話のコンテキスト')
  }),
  outputSchema: z.object({
    emotion: z.enum(['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised', 'thinking']),
    confidence: z.number().min(0).max(1)
  }),
  execute: async ({ context }) => {
    const { message, context: conversationContext } = context;
    
    // 感情検出ロジック
    const emotion = detectEmotion(message, conversationContext);
    
    return {
      emotion,
      confidence: 0.85
    };
  }
});
```

#### Mastraの利点
1. **型安全な統合**: TypeScriptベースで自動補完とエラーチェック
2. **メモリー管理**: 会話履歴を自動保存・取得
3. **ワークフロー**: 複雑なエージェント処理をグラフで管理
4. **観測性**: OpenTelemetryで全処理をトレース
5. **評価**: LLM出力の品質を自動評価
6. **デプロイ**: Vercel/Cloudflare Workersに簡単デプロイ

---

### 3. ボトムシートUI設計

#### デザイン仕様

**レイアウト:**
```
┌─────────────────────────┐
│                         │
│   AR View + VRM Avatar  │
│                         │
│                         │
├─────────────────────────┤  ← ドラッグハンドル
│  💬 直近のメッセージ      │
│  ───────────────────    │
│  User: こんにちは        │
│  Bot: こんにちは！ばい   │  ← ボトムシート
│                         │   （展開/折りたたみ可能）
│  [メッセージ入力欄]  [送信] │
└─────────────────────────┘
```

#### 実装コンポーネント

**`src/components/BottomSheet.ts`:**
```typescript
export class BottomSheet {
  private container: HTMLElement;
  private messagesContainer: HTMLElement;
  private inputContainer: HTMLElement;
  private dragHandle: HTMLElement;
  
  private isExpanded: boolean = false;
  private startY: number = 0;
  private currentY: number = 0;
  
  // 展開レベル
  private readonly COLLAPSED_HEIGHT = 120; // 最小化（入力欄のみ）
  private readonly PEEK_HEIGHT = 240;      // 2メッセージ表示
  private readonly EXPANDED_HEIGHT = 480;  // 全画面の60%
  
  constructor() {
    this.createBottomSheet();
    this.attachDragListeners();
    this.attachSwipeGestures();
  }
  
  private createBottomSheet(): void {
    const html = `
      <div id="bottom-sheet" class="bottom-sheet">
        <div class="drag-handle"></div>
        <div class="messages-preview">
          <!-- 直近2メッセージのみ表示 -->
        </div>
        <div class="input-container">
          <input type="text" placeholder="メッセージを入力..." />
          <button class="send-button">送信</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    
    this.container = document.getElementById('bottom-sheet')!;
    this.dragHandle = this.container.querySelector('.drag-handle')!;
    this.messagesContainer = this.container.querySelector('.messages-preview')!;
    this.inputContainer = this.container.querySelector('.input-container')!;
  }
  
  private attachDragListeners(): void {
    this.dragHandle.addEventListener('touchstart', this.onDragStart.bind(this));
    this.dragHandle.addEventListener('touchmove', this.onDragMove.bind(this));
    this.dragHandle.addEventListener('touchend', this.onDragEnd.bind(this));
  }
  
  private onDragStart(e: TouchEvent): void {
    this.startY = e.touches[0].clientY;
  }
  
  private onDragMove(e: TouchEvent): void {
    this.currentY = e.touches[0].clientY;
    const deltaY = this.startY - this.currentY;
    
    // ドラッグに応じて高さを調整
    const newHeight = Math.max(
      this.COLLAPSED_HEIGHT,
      Math.min(this.EXPANDED_HEIGHT, this.container.offsetHeight + deltaY)
    );
    
    this.container.style.height = `${newHeight}px`;
  }
  
  private onDragEnd(): void {
    const currentHeight = this.container.offsetHeight;
    
    // スナップポイントを決定
    if (currentHeight < this.PEEK_HEIGHT) {
      this.collapse();
    } else if (currentHeight < this.EXPANDED_HEIGHT * 0.7) {
      this.peek();
    } else {
      this.expand();
    }
  }
  
  public collapse(): void {
    this.container.style.height = `${this.COLLAPSED_HEIGHT}px`;
    this.messagesContainer.style.display = 'none';
    this.isExpanded = false;
  }
  
  public peek(): void {
    this.container.style.height = `${this.PEEK_HEIGHT}px`;
    this.messagesContainer.style.display = 'block';
    this.displayRecentMessages(2);
    this.isExpanded = false;
  }
  
  public expand(): void {
    this.container.style.height = `${this.EXPANDED_HEIGHT}px`;
    this.messagesContainer.style.display = 'block';
    this.displayRecentMessages(10);
    this.isExpanded = true;
  }
  
  private displayRecentMessages(count: number): void {
    // 直近のメッセージのみ表示
    const messages = this.getRecentMessages(count);
    this.messagesContainer.innerHTML = messages
      .map(msg => this.createMessageBubble(msg))
      .join('');
  }
}
```

**`src/styles/bottom-sheet.css`:**
```css
.bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
  transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  
  /* デフォルトは折りたたみ状態 */
  height: 120px;
}

.drag-handle {
  width: 40px;
  height: 4px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 2px;
  margin: 12px auto;
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}

.messages-preview {
  padding: 0 16px;
  overflow-y: auto;
  max-height: 300px;
  
  /* スムーズなスクロール */
  -webkit-overflow-scrolling: touch;
}

.input-container {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px 20px 0 0;
  display: flex;
  gap: 8px;
}

.input-container input {
  flex: 1;
  padding: 12px 16px;
  border: none;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.9);
  font-size: 16px;
}

.send-button {
  padding: 12px 24px;
  border: none;
  border-radius: 24px;
  background: #667eea;
  color: white;
  font-weight: 600;
  cursor: pointer;
}

/* モバイル最適化 */
@media (max-width: 768px) {
  .bottom-sheet {
    /* タブレットでも同じ動作 */
  }
}

/* 横画面対応 */
@media (orientation: landscape) and (max-height: 600px) {
  .bottom-sheet {
    /* 横画面時は控えめに */
    height: 80px;
  }
  
  .messages-preview {
    max-height: 200px;
  }
}
```

#### UI改善のポイント
1. **背景の可視性**: ARコンテンツとVRMが常に見える
2. **段階的展開**: 折りたたみ → プレビュー → 全画面の3段階
3. **スムーズなジェスチャー**: ドラッグ&スワイプで直感的操作
4. **レスポンシブ**: スマホ・タブレット・横画面に対応
5. **最小化時**: 入力欄のみ表示でARに集中可能

---

## 📅 実装スケジュール

### Week 1: TypeScript環境構築
- [ ] Day 1-2: TypeScript設定、型定義ファイル作成
- [ ] Day 3-4: バックエンド型定義
- [ ] Day 5-7: フロントエンド型定義、ビルドシステム構築

### Week 2: バックエンド移行
- [ ] Day 1-3: `server/index.ts` 移行
- [ ] Day 4-5: `gemini.service.ts` 移行
- [ ] Day 6-7: Mastraセットアップ、基本エージェント実装

### Week 3: フロントエンド移行 + UI改善
- [ ] Day 1-2: ボトムシートコンポーネント実装
- [ ] Day 3-4: チャット機能のTypeScript移行
- [ ] Day 5-6: VRMコントローラーのTypeScript移行
- [ ] Day 7: 統合テスト

### Week 4: Mastra統合 + 最終調整
- [ ] Day 1-2: エージェントツール実装（カレンダー、感情）
- [ ] Day 3-4: メモリーとワークフロー統合
- [ ] Day 5-6: モバイルデバイステスト
- [ ] Day 7: ドキュメント更新、完了報告

---

## 🧪 テスト計画

### 1. 型安全性テスト
- TypeScriptコンパイルエラーなし
- ESLintによる静的解析
- 型推論の正確性確認

### 2. 機能テスト
- **チャット機能**: メッセージ送受信、感情検出
- **VRMアニメーション**: 7種類の感情別アニメーション
- **Mastraエージェント**: ツール呼び出し、メモリー保存
- **ボトムシート**: 展開/折りたたみ、スワイプ操作

### 3. デバイステスト
- **iOS**: Safari 18+ (iPhone 13以降)
- **Android**: Chrome 120+ (Pixel 6以降)
- **タブレット**: iPad Pro, Galaxy Tab
- **横画面**: すべてのデバイス

### 4. パフォーマンステスト
- 初回ロード時間: <3秒
- チャット応答時間: <2秒
- アニメーション遷移: 60fps維持

---

## 📊 成功指標

### 技術指標
- [ ] TypeScript化率: 100%
- [ ] 型エラー: 0件
- [ ] ビルド時間: <30秒
- [ ] バンドルサイズ: <500KB (gzip)

### UX指標
- [ ] モバイルユーザビリティスコア: 90+点
- [ ] タスク完了率: 95%以上
- [ ] ユーザー満足度: 4.5/5以上
- [ ] チャット入力速度: 従来比30%向上

### 開発指標
- [ ] コード行数: 30%削減（型推論による）
- [ ] バグ発生率: 50%削減（型安全性による）
- [ ] 開発速度: 40%向上（Mastra統合による）

---

## 💰 リソース見積もり

### 開発工数
- TypeScript移行: 1.5週間（1人）
- Mastra統合: 1週間（1人）
- UI改善: 1.5週間（1人）
- テスト: 1週間（1人）

**合計**: 約4週間（1人）

### 外部コスト
- Mastra: オープンソース（無料）
- TypeScript: 無料
- 追加ライブラリ: ¥0

---

## 🚀 デプロイ戦略

### ステージング環境
- Vercel Preview Deployments
- 各PR作成時に自動デプロイ
- HTTPS対応（モバイルテスト必須）

### プロダクション環境
- Vercel Production
- カスタムドメイン設定
- CDN最適化
- エラートラッキング（Sentry等）

---

## 📝 リスクと対策

### リスク1: TypeScript移行によるバグ
**影響**: 高  
**対策**: 
- 段階的移行（ファイル単位）
- 既存機能のリグレッションテスト
- 型定義の段階的強化

### リスク2: Mastra学習コスト
**影響**: 中  
**対策**:
- 公式ドキュメント活用
- シンプルなエージェントから開始
- コミュニティサポート活用

### リスク3: UIパフォーマンス低下
**影響**: 中  
**対策**:
- React Three Fiber検討（将来）
- 仮想スクロール実装
- メッセージ表示数制限

### リスク4: モバイルブラウザ互換性
**影響**: 高  
**対策**:
- 複数デバイスでの実機テスト
- ポリフィル追加
- フォールバックUI準備

---

## 🎯 次のステップ

### Phase 3完了後
1. **Phase 4**: 音声会話（TTS + STT）
2. **Phase 5**: リップシンク実装
3. **Phase 6**: RAG統合（社内ドキュメント検索）
4. **Phase 7**: マルチモーダル対応（画像・動画入力）

### 長期ロードマップ
- AI Pipelinesとの統合
- エンタープライズ向け機能追加
- 複数言語対応（英語、中国語等）
- VRM以外のアバターフォーマット対応

---

## 💬 承認依頼

以下の内容について、PdMの承認をお願いします：

1. **Phase 3開始の承認**
2. **TypeScript移行戦略の承認**
3. **Mastra統合の承認**
4. **ボトムシートUI設計の承認**
5. **4週間の開発スケジュール承認**

承認いただければ、直ちに実装を開始します。

---

**報告日**: 2025年10月2日  
**開発チーム**: Claude Code + 寺田様
