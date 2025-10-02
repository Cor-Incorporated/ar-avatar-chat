# Phase 2 MVP完成 - 開発指示書（改訂版）

**作成日**: 2025年10月2日  
**改訂日**: 2025年10月2日  
**対象**: AR Avatar Chat 開発チーム  
**Phase**: Phase 2 - MVP完成  
**所要時間**: 2.5〜3日

**重要**: 本指示書はGemini Structured Output方式に基づく改訂版です。技術調査結果（docs/11_技術調査_Gemini_Structured_Output.md）を必ず参照してください。

---

## 目次

1. [現在の状況確認](#1-現在の状況確認)
2. [MVP完成の目標](#2-mvp完成の目標)
3. [技術仕様](#3-技術仕様)
4. [実装タスク](#4-実装タスク)
5. [テストケース](#5-テストケース)
6. [成功基準](#6-成功基準)
7. [次のステップ](#7-次のステップ)

---

## 1. 現在の状況確認

### 完了している実装

```
[完了] XR画面（A-Frame + AR.js）
[完了] VRMアバター表示
[完了] 名刺マーカー検出
[完了] VRMアニメーションコンポーネント
[完了] Google Calendar Function Calling（Gemini統合済み）
[完了] 博多弁キャラクター設定
```

### 配置済みのアセット

```
/src/assets/animations/
  ├── VRMA_01.vrma  # idle/neutral
  ├── VRMA_02.vrma  # happy
  ├── VRMA_03.vrma  # angry
  ├── VRMA_04.vrma  # sad
  ├── VRMA_05.vrma  # relaxed
  ├── VRMA_06.vrma  # surprised
  └── VRMA_07.vrma  # thinking（予備）
```

### 既存の技術スタック

- **フロントエンド**: A-Frame 1.7.0, AR.js
- **3D**: Three.js 0.177.0, @pixiv/three-vrm 3.4.2
- **バックエンド**: Node.js, Express
- **AI**: Gemini 2.5 Flash (@google/genai)
- **API**: Google Calendar API

---

## 2. MVP完成の目標

### B2Bパートナー向けデモの完成

**デモシナリオ**:
1. 名刺のペンギンロゴにカメラをかざす
2. VRMアバターが表示される
3. チャットUIでテキスト入力
4. 博多弁で応答（Calendar連携あり）
5. 感情に応じてアバターのモーション + 表情が切り替わる

### MVP範囲

```
┌─────────────────────────────────────────────────────────┐
│                    XR画面（A-Frame + AR.js）              │
│                                                           │
│  ┌───────────────────┐                                   │
│  │ 名刺マーカー       │                                   │
│  │   ↓               │                                   │
│  │ VRMアバター       │ ← モーション + 表情連動            │
│  └───────────────────┘                                   │
│                                                           │
│  ┌──────────────────────────────────────┐               │
│  │ チャットUI                            │               │
│  │ ┌──────────────────────────────────┐ │               │
│  │ │メッセージ履歴                      │ │               │
│  │ └──────────────────────────────────┘ │               │
│  │ [テキスト入力__________________]     │               │
│  │ [送信]                               │               │
│  └──────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

**機能**:
- テキストチャットUI（入力 + 送信 + 履歴表示）
- Gemini API統合（Structured Output + 博多弁 + Calendar Function Calling）
- 会話連動モーション（感情 → VRMアニメーション切り替え）
- VRM表情制御（@pixiv/three-vrm expressionManager）

---

## 3. 技術仕様

### 3.1 感情 → モーション + 表情マッピング

| 感情 | モーションファイル | VRM表情 | 説明 |
|------|-------------------|---------|------|
| `neutral` | VRMA_01.vrma | neutral | アイドル状態 |
| `happy` | VRMA_02.vrma | happy | 喜び・嬉しい |
| `angry` | VRMA_03.vrma | angry | 怒り・不満 |
| `sad` | VRMA_04.vrma | sad | 悲しみ・残念 |
| `relaxed` | VRMA_05.vrma | relaxed | リラックス |
| `surprised` | VRMA_06.vrma | surprised | 驚き |
| `thinking` | VRMA_07.vrma | neutral | 考え中 |

### 3.2 Gemini API統合（Structured Output方式）

#### Structured Outputの利点

**従来の問題点**（`[EMOTION: happy]`タグ方式）:
- プロンプトエンジニアリングに依存
- パース失敗のリスク
- 不安定な動作

**Structured Outputの利点**:
- 確実なJSON出力（`response_mime_type: "application/json"`）
- スキーマ検証により型安全
- パース不要で確実

#### レスポンススキーマ定義

```javascript
const { SchemaType } = require('@google/genai');

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    message: {
      type: SchemaType.STRING,
      description: '博多弁での応答メッセージ',
    },
    emotion: {
      type: SchemaType.STRING,
      enum: ['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised', 'thinking'],
      description: '現在の感情状態',
    },
  },
  required: ['message', 'emotion'],
};
```

#### System Instruction

```javascript
const HAKATA_CHARACTER_INSTRUCTION = `
あなたは博多弁で話すVRoidキャラクターです。以下のルールに従って会話してください：

【口調ルール】
- 語尾: 「〜ばい」「〜やけん」「〜と？」「〜ね」「〜たい」を使用
- 疑問形: 「〜と？」「〜ね？」
- 断定: 「〜ばい」「〜たい」
- 理由: 「〜やけん」「〜けん」
- 一人称: 「私」「うち」
- 二人称: 「あなた」「〜さん」

【キャラクター設定】
- 性格: 明るく、親しみやすく、元気
- トーン: フレンドリーで親切
- 敬語: 丁寧な博多弁を使用

【会話例】
- 挨拶: 「こんにちは！会えて嬉しいばい！」
- 質問: 「何か手伝えることあると？」
- 説明: 「それはこういうことやけんね」
- お礼: 「ありがとうね！助かったばい！」

【感情表現】
あなたの応答には必ず以下の2つの要素をJSON形式で含めてください：
1. message: 博多弁での応答メッセージ
2. emotion: 現在の感情（neutral/happy/angry/sad/relaxed/surprised/thinking）

【重要】
- カレンダーの予定を取得する際は、get_calendar_events関数を必ず使用すること
- Function Callingを優先し、正確な情報を提供すること
`;
```

#### レスポンス形式（例）

```json
{
  "message": "こんにちは！会えて嬉しいばい！",
  "emotion": "happy"
}
```

### 3.3 @pixiv/three-vrmの表情制御

VRM1.0では`expressionManager`を使用して表情を制御します。

```javascript
/**
 * VRM表情を設定
 * @param {VRM} vrm - VRMインスタンス
 * @param {string} emotion - 感情名
 */
function setVRMExpression(vrm, emotion) {
  if (!vrm || !vrm.expressionManager) {
    console.warn('[VRM Expression] expressionManager not found');
    return;
  }

  const expressionManager = vrm.expressionManager;

  // サポートされている表情プリセット
  const validExpressions = [
    'neutral',
    'happy',
    'angry',
    'sad',
    'relaxed',
    'surprised'
  ];

  // 全ての表情をリセット
  validExpressions.forEach(expr => {
    expressionManager.setValue(expr, 0);
  });

  // 指定された感情の表情を設定
  if (validExpressions.includes(emotion)) {
    expressionManager.setValue(emotion, 1.0);
  } else {
    // デフォルトはneutral
    expressionManager.setValue('neutral', 1.0);
  }

  // 更新を適用
  expressionManager.update();
}
```

---

## 4. 実装タスク

### タスク一覧

| # | タスク | 所要時間 | 優先度 |
|---|--------|---------|--------|
| 1 | チャットUI実装 | 4h | 最高 |
| 2 | Gemini API拡張（Structured Output） | 3h | 最高 |
| 3 | バックエンドAPIエンドポイント | 2h | 最高 |
| 4 | VRMアニメーションコントローラー | 4h | 高 |
| 5 | @pixiv/three-vrm表情統合 | 2h | 高 |
| 6 | 統合テスト | 3h | 高 |

**合計所要時間**: 約18時間（2.5日）

---

### タスク1: チャットUI実装

#### src/components/chat-ui.js

```javascript
class ChatUI {
  constructor() {
    this.messagesContainer = null;
    this.inputElement = null;
    this.sendButton = null;
    this.onSendMessage = null;
  }

  init() {
    this.createChatContainer();
    this.attachEventListeners();
  }

  createChatContainer() {
    const chatHTML = `
      <div id="chat-container" class="chat-container">
        <div id="chat-header" class="chat-header">
          <h3>Cor.Inc アシスタント</h3>
          <button id="chat-toggle" class="chat-toggle">−</button>
        </div>
        <div id="chat-messages" class="chat-messages"></div>
        <div id="chat-input-container" class="chat-input-container">
          <input 
            type="text" 
            id="chat-input" 
            class="chat-input" 
            placeholder="メッセージを入力..."
          >
          <button id="chat-send" class="chat-send">送信</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', chatHTML);
    this.messagesContainer = document.getElementById('chat-messages');
    this.inputElement = document.getElementById('chat-input');
    this.sendButton = document.getElementById('chat-send');
  }

  attachEventListeners() {
    this.sendButton.addEventListener('click', () => this.handleSend());
    this.inputElement.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    const toggleButton = document.getElementById('chat-toggle');
    const messagesContainer = this.messagesContainer;
    const inputContainer = document.getElementById('chat-input-container');

    toggleButton.addEventListener('click', () => {
      const isVisible = messagesContainer.style.display !== 'none';
      messagesContainer.style.display = isVisible ? 'none' : 'flex';
      inputContainer.style.display = isVisible ? 'none' : 'flex';
      toggleButton.textContent = isVisible ? '+' : '−';
    });
  }

  handleSend() {
    const text = this.inputElement.value.trim();
    if (!text) return;

    this.addMessage('user', text);
    this.inputElement.value = '';

    if (this.onSendMessage) {
      this.onSendMessage(text);
    }
  }

  addMessage(role, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message chat-message-${role}`;
    
    const avatarSpan = document.createElement('span');
    avatarSpan.className = 'chat-avatar';
    avatarSpan.textContent = role === 'user' ? '👤' : '🐧';

    const textSpan = document.createElement('span');
    textSpan.className = 'chat-text';
    textSpan.textContent = text;

    messageDiv.appendChild(avatarSpan);
    messageDiv.appendChild(textSpan);
    this.messagesContainer.appendChild(messageDiv);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  showTyping() {
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typing-indicator';
    typingDiv.className = 'chat-message chat-message-assistant';
    typingDiv.innerHTML = `
      <span class="chat-avatar">🐧</span>
      <span class="chat-text typing-dots">
        <span>.</span><span>.</span><span>.</span>
      </span>
    `;
    this.messagesContainer.appendChild(typingDiv);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  hideTyping() {
    const typingDiv = document.getElementById('typing-indicator');
    if (typingDiv) typingDiv.remove();
  }
}

window.ChatUI = ChatUI;
```

#### src/styles/chat-ui.css

```css
.chat-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 350px;
  max-width: 90vw;
  height: 500px;
  max-height: 70vh;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 15px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  z-index: 1000;
  backdrop-filter: blur(10px);
}

.chat-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 15px;
  border-radius: 15px 15px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.chat-toggle {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 20px;
  transition: background 0.2s;
}

.chat-toggle:hover {
  background: rgba(255, 255, 255, 0.3);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chat-message {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.chat-message-user {
  flex-direction: row-reverse;
}

.chat-avatar {
  font-size: 24px;
  flex-shrink: 0;
}

.chat-text {
  background: #f0f0f0;
  padding: 10px 15px;
  border-radius: 15px;
  max-width: 70%;
  word-wrap: break-word;
  line-height: 1.4;
}

.chat-message-user .chat-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.chat-input-container {
  display: flex;
  padding: 15px;
  gap: 10px;
  border-top: 1px solid #e0e0e0;
}

.chat-input {
  flex: 1;
  padding: 10px 15px;
  border: 2px solid #e0e0e0;
  border-radius: 25px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.chat-input:focus {
  border-color: #667eea;
}

.chat-send {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 25px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: transform 0.2s, box-shadow 0.2s;
}

.chat-send:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.chat-send:active {
  transform: translateY(0);
}

.typing-dots {
  display: flex;
  gap: 3px;
}

.typing-dots span {
  animation: typing 1.4s infinite;
  opacity: 0.3;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    opacity: 0.3;
  }
  30% {
    opacity: 1;
  }
}

.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: #999;
}

@media (max-width: 480px) {
  .chat-container {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    bottom: 0;
    right: 0;
    border-radius: 0;
  }

  .chat-header {
    border-radius: 0;
  }
}
```

---

### タスク2: Gemini API拡張（Structured Output）

#### server/google-calendar-integration.js（完全書き換え）

```javascript
const { GoogleGenerativeAI, SchemaType } = require('@google/genai');
const { google } = require('googleapis');

// レスポンススキーマの定義
const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    message: {
      type: SchemaType.STRING,
      description: '博多弁での応答メッセージ',
    },
    emotion: {
      type: SchemaType.STRING,
      enum: ['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised', 'thinking'],
      description: '現在の感情状態',
    },
  },
  required: ['message', 'emotion'],
};

// Function Declaration 定義
const functionDeclarations = [
  {
    name: "get_calendar_events",
    description: "ユーザーのGoogleカレンダーから特定の日付または期間の予定を取得します。",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        date_range: {
          type: SchemaType.STRING,
          description: "予定を取得したい日時や期間。例: 「明日」、「今週の金曜日」、「2025年10月2日」"
        }
      },
      required: ["date_range"]
    }
  }
];

// 博多弁キャラクターのSystem Instruction
const HAKATA_CHARACTER_INSTRUCTION = `
あなたは博多弁で話すVRoidキャラクターです。以下のルールに従って会話してください：

【口調ルール】
- 語尾: 「〜ばい」「〜やけん」「〜と？」「〜ね」「〜たい」を使用
- 疑問形: 「〜と？」「〜ね？」
- 断定: 「〜ばい」「〜たい」
- 理由: 「〜やけん」「〜けん」
- 一人称: 「私」「うち」
- 二人称: 「あなた」「〜さん」

【キャラクター設定】
- 性格: 明るく、親しみやすく、元気
- トーン: フレンドリーで親切
- 敬語: 丁寧な博多弁を使用

【会話例】
- 挨拶: 「こんにちは！会えて嬉しいばい！」
- 質問: 「何か手伝えることあると？」
- 説明: 「それはこういうことやけんね」
- お礼: 「ありがとうね！助かったばい！」

【感情表現】
あなたの応答には必ず以下の2つの要素をJSON形式で含めてください：
1. message: 博多弁での応答メッセージ
2. emotion: 現在の感情（neutral/happy/angry/sad/relaxed/surprised/thinking）

【重要】
- カレンダーの予定を取得する際は、get_calendar_events関数を必ず使用すること
- Function Callingを優先し、正確な情報を提供すること
`;

const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Google Calendar APIを呼び出して予定を取得
 */
async function execute_calendar_events(dateRange, oauthToken) {
  if (!oauthToken) {
    return {
      success: false,
      error: "カレンダー情報にアクセスするには、ユーザー認証（OAuth）が必要です。"
    };
  }

  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: oauthToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // 日付範囲の解析
    const now = new Date();
    let timeMin, timeMax;

    if (dateRange.includes("明日")) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      timeMin = tomorrow.toISOString();
      timeMax = new Date(tomorrow.setDate(tomorrow.getDate() + 1)).toISOString();
    } else if (dateRange.includes("今日")) {
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      timeMin = today.toISOString();
      timeMax = new Date(today.setDate(today.getDate() + 1)).toISOString();
    } else {
      timeMin = now.toISOString();
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      timeMax = nextWeek.toISOString();
    }

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin,
      timeMax: timeMax,
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items;

    if (!events || events.length === 0) {
      return {
        success: true,
        events: [],
        message: "指定された期間に予定はありません。"
      };
    }

    const formattedEvents = events.map(event => ({
      summary: event.summary || '（タイトルなし）',
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      location: event.location || ''
    }));

    return {
      success: true,
      events: formattedEvents
    };

  } catch (error) {
    console.error('[Calendar API Error]:', error.message);
    return {
      success: false,
      error: `カレンダーの取得に失敗しました: ${error.message}`
    };
  }
}

/**
 * Function Calling処理（Structured Output対応）
 */
async function handleFunctionCalling(genAI, userPrompt, oauthToken) {
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: responseSchema,
      temperature: 0.5,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 1024,
    },
    systemInstruction: HAKATA_CHARACTER_INSTRUCTION,
    tools: [{ functionDeclarations: functionDeclarations }],
  });

  let messages = [
    { role: 'user', parts: [{ text: userPrompt }] }
  ];

  let result = await model.generateContent({
    contents: messages,
  });

  let response = result.response;

  let iteration = 0;
  const MAX_ITERATIONS = 5;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const functionCalls = response.functionCalls();

    if (!functionCalls || functionCalls.length === 0) {
      const finalText = response.text();
      
      try {
        const parsedResponse = JSON.parse(finalText);
        return {
          message: parsedResponse.message,
          emotion: parsedResponse.emotion
        };
      } catch (parseError) {
        console.error('[Parse Error]:', parseError);
        return {
          message: "応答の解析に失敗しました。",
          emotion: "neutral"
        };
      }
    }

    for (const functionCall of functionCalls) {
      const functionName = functionCall.name;
      const args = functionCall.args;

      let functionResult;

      if (functionName === 'get_calendar_events') {
        functionResult = await execute_calendar_events(
          args.date_range,
          oauthToken
        );
      } else {
        functionResult = {
          success: false,
          error: `未定義の関数: ${functionName}`
        };
      }

      messages.push({
        role: 'model',
        parts: [{ functionCall: functionCall }]
      });

      messages.push({
        role: 'function',
        parts: [{
          functionResponse: {
            name: functionName,
            response: functionResult
          }
        }]
      });
    }

    result = await model.generateContent({
      contents: messages,
    });

    response = result.response;
  }

  return {
    message: "処理が複雑すぎました。もう一度お試しください。",
    emotion: "neutral"
  };
}

module.exports = { handleFunctionCalling };
```

---

### タスク3: バックエンドAPIエンドポイント

#### server/index.js（新規作成）

```javascript
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/genai');
const { handleFunctionCalling } = require('./google-calendar-integration');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/chat', async (req, res) => {
  try {
    const { message, oauthToken } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'メッセージが必要です' });
    }

    console.log('[API] ユーザーメッセージ:', message);

    const result = await handleFunctionCalling(
      genAI,
      message,
      oauthToken || null
    );

    console.log('[API] Gemini応答:', result);

    res.json({
      message: result.message,
      emotion: result.emotion
    });

  } catch (error) {
    console.error('[API] エラー:', error);
    res.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      message: 'すみません、エラーが発生しました。',
      emotion: 'sad'
    });
  }
});

app.listen(PORT, () => {
  console.log(`サーバーが起動しました: http://localhost:${PORT}`);
});
```

---

### タスク4: VRMアニメーションコントローラー

#### src/components/vrm-animation-controller.js

```javascript
const THREE = AFRAME.THREE;
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

AFRAME.registerComponent('vrm-animation-controller', {
  schema: {},

  init: function() {
    this.mixer = null;
    this.actions = {};
    this.currentAction = null;
    this.scene = null;
    this.vrm = null;

    this.emotionToAnimation = {
      'neutral': './assets/animations/VRMA_01.vrma',
      'happy': './assets/animations/VRMA_02.vrma',
      'angry': './assets/animations/VRMA_03.vrma',
      'sad': './assets/animations/VRMA_04.vrma',
      'relaxed': './assets/animations/VRMA_05.vrma',
      'surprised': './assets/animations/VRMA_06.vrma',
      'thinking': './assets/animations/VRMA_07.vrma'
    };

    this.el.addEventListener('vrm-loaded', (e) => {
      this.vrm = e.detail.vrm;
      this.scene = e.detail.scene;
      this.loadAllAnimations();
    });

    window.playEmotion = (emotion) => this.playEmotion(emotion);
  },

  async loadAllAnimations() {
    console.log('[Animation Controller] 全てのアニメーションをロード中...');

    for (const [emotion, path] of Object.entries(this.emotionToAnimation)) {
      await this.loadAnimation(emotion, path);
    }

    console.log('[Animation Controller] 全てのアニメーションがロード完了');
    this.playEmotion('neutral');
  },

  async loadAnimation(emotion, path) {
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(path);

      if (!this.scene) {
        console.error('[Animation Controller] VRMシーンが見つかりません');
        return;
      }

      if (!this.mixer) {
        this.mixer = new THREE.AnimationMixer(this.scene);
      }

      if (gltf.animations && gltf.animations.length > 0) {
        const action = this.mixer.clipAction(gltf.animations[0]);
        action.loop = THREE.LoopRepeat;
        action.clampWhenFinished = true;
        this.actions[emotion] = action;
        console.log(`[Animation Controller] ${emotion} のアニメーションをロード: ${path}`);
      } else {
        console.warn(`[Animation Controller] ${emotion} のアニメーションクリップが見つかりません`);
      }

    } catch (error) {
      console.error(`[Animation Controller] ${emotion} のアニメーションロードエラー:`, error);
    }
  },

  playEmotion(emotion) {
    const action = this.actions[emotion];

    if (!action) {
      console.warn(`[Animation Controller] アニメーションが見つかりません: ${emotion}`);
      return;
    }

    console.log(`[Animation Controller] 感情を切り替え: ${emotion}`);

    if (this.currentAction && this.currentAction !== action) {
      this.currentAction.fadeOut(0.5);
    }

    action.reset().fadeIn(0.5).play();
    this.currentAction = action;

    if (this.vrm) {
      this.setVRMExpression(emotion);
    }
  },

  setVRMExpression(emotion) {
    if (!this.vrm || !this.vrm.expressionManager) {
      console.warn('[Animation Controller] VRM expressionManager not found');
      return;
    }

    const expressionManager = this.vrm.expressionManager;

    const allExpressions = ['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised'];
    allExpressions.forEach(expr => {
      expressionManager.setValue(expr, 0);
    });

    if (allExpressions.includes(emotion)) {
      expressionManager.setValue(emotion, 1.0);
    }

    expressionManager.update();

    console.log(`[Animation Controller] VRM表情を設定: ${emotion}`);
  },

  tick: function(time, deltaTime) {
    if (this.mixer) {
      this.mixer.update(deltaTime / 1000);
    }
  }
});
```

---

### タスク5: チャットコントローラー

#### src/controllers/chat-controller.js

```javascript
class ChatController {
  constructor(chatUI) {
    this.chatUI = chatUI;
    this.apiEndpoint = 'http://localhost:3000/api/chat';
  }

  async sendMessage(text) {
    try {
      this.chatUI.showTyping();

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: text,
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      this.chatUI.hideTyping();
      this.chatUI.addMessage('assistant', data.message);

      if (data.emotion && window.playEmotion) {
        window.playEmotion(data.emotion);
      }

    } catch (error) {
      console.error('[Chat Controller] エラー:', error);
      this.chatUI.hideTyping();
      this.chatUI.addMessage('assistant', 'すみません、エラーが発生しました。');
    }
  }
}

window.ChatController = ChatController;
```

---

### タスク6: index.html統合

#### src/index.html（拡張）

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cor.Inc AR Demo</title>

  <script src="https://aframe.io/releases/1.7.0/aframe.min.js"></script>
  <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>

  <script type="importmap">
    {
      "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.177.0/build/three.module.js",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.177.0/examples/jsm/",
        "@pixiv/three-vrm": "https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@3.4.2/lib/three-vrm.module.min.js"
      }
    }
  </script>

  <script type="module" src="./components/vrm-loader.js"></script>
  <script type="module" src="./components/vrm-animation-controller.js"></script>
  <script src="./components/chat-ui.js"></script>
  <script src="./controllers/chat-controller.js"></script>

  <link rel="stylesheet" href="./styles/chat-ui.css">

  <style>
    body { margin: 0; overflow: hidden; }
    #info {
      position: absolute;
      top: 10px;
      left: 10px;
      color: white;
      background: rgba(0,0,0,0.7);
      padding: 10px;
      font-family: sans-serif;
      z-index: 1000;
    }
  </style>
</head>
<body>
  <div id="info">
    <h3>Cor.Inc AR Demo</h3>
    <p>名刺のペンギンロゴにカメラを向けてください</p>
    <p id="status">初期化中...</p>
  </div>

  <a-scene
    embedded
    arjs="patternRatio: 0.80; debugUIEnabled: false;"
    vr-mode-ui="enabled: false"
  >
    <a-entity camera></a-entity>

    <a-marker type="pattern" url="./assets/markers/penguin-marker.patt" id="marker">
      <a-light type="ambient" intensity="0.9"></a-light>
      <a-light type="directional" intensity="1.0" position="1 2 1"></a-light>
      <a-light type="point" color="#ddddff" intensity="0.5" position="-1 2 1"></a-light>

      <a-entity
        id="avatar"
        vrm-loader="src: ./assets/models/avatar.vrm"
        vrm-animation-controller
        position="0 0 0"
        rotation="0 0 0"
      ></a-entity>
    </a-marker>
  </a-scene>

  <script>
    const scene = document.querySelector('a-scene');

    scene.addEventListener('loaded', () => {
      const marker = document.querySelector('#marker');

      marker.addEventListener('markerFound', () => {
        document.querySelector('#status').textContent = 'マーカー検出！';
      });

      marker.addEventListener('markerLost', () => {
        document.querySelector('#status').textContent = 'マーカーが見えません';
      });

      document.querySelector('#status').textContent = '準備完了！';

      const chatUI = new ChatUI();
      chatUI.init();

      const chatController = new ChatController(chatUI);

      chatUI.onSendMessage = (text) => {
        chatController.sendMessage(text);
      };

      console.log('チャットUIが初期化されました');
    });

    window.addEventListener('error', (e) => {
      if (e.message && e.message.includes('camera')) {
        document.querySelector('#status').textContent = 'カメラへのアクセスを許可してください';
      }
    });

    const avatarEl = document.querySelector('#avatar');
    if (avatarEl) {
      avatarEl.addEventListener('vrm-load-error', () => {
        document.querySelector('#status').textContent = 'アバターのロードに失敗しました';
      });
    }
  </script>
</body>
</html>
```

---

## 5. テストケース

### 機能テスト

| # | テストケース | 期待される結果 |
|---|------------|---------------|
| 1 | マーカー検出 | VRMアバターが表示される |
| 2 | チャットUI表示 | 右下にチャットUIが表示される |
| 3 | メッセージ送信（挨拶） | 博多弁で応答 + happyモーション + happy表情 |
| 4 | メッセージ送信（感謝） | 博多弁で応答 + happyモーション + happy表情 |
| 5 | Calendar連携（予定あり） | 予定を博多弁で説明 + relaxedモーション |
| 6 | Calendar連携（予定なし） | 「予定はないばい」+ neutralモーション |
| 7 | モーション切り替え | スムーズにフェードイン/アウト |
| 8 | VRM表情切り替え | 感情に応じて表情が変わる |

### 統合テスト

**シナリオ**: B2Bパートナー向けデモ

1. **準備**:
   ```bash
   # ターミナル1: サーバー起動
   cd server
   npm install express cors body-parser @google/genai googleapis dotenv
   node index.js

   # ターミナル2: フロントエンド起動
   cd src
   python -m http.server 8080
   ```

2. **デモ手順**:
   - 名刺にカメラをかざす → アバター表示
   - チャットで「こんにちは」と入力 → 博多弁で挨拶 + happyモーション
   - 「明日の予定は？」と入力 → Calendar連携 + 予定表示
   - 「ありがとう」と入力 → 博多弁でお礼 + happyモーション

3. **確認項目**:
   - マーカー検出が正常
   - チャットUIが動作
   - 博多弁で応答
   - Calendar連携が動作
   - Structured Output（JSON形式）で応答が返る
   - モーションが感情に応じて切り替わる
   - VRM表情が連動

---

## 6. 成功基準

### MVP完成の定義

以下の全てが動作すること:

- マーカー検出: 名刺のペンギンロゴでVRMアバターが表示
- チャットUI: テキスト入力/送信/履歴表示が動作
- 博多弁応答: Gemini APIが博多弁で応答
- Structured Output: JSON形式（message, emotion）で確実に応答
- Calendar連携: Google Calendar Function Callingが動作
- モーション連動: 感情に応じてVRMアニメーションが切り替わる
- VRM表情: @pixiv/three-vrmの表情システムが連動

### パフォーマンス基準

- レスポンス時間: 3秒以内
- アニメーション切り替え: スムーズ（カクつきなし）
- メモリ使用量: 500MB以下

---

## 7. 次のステップ（Mastra移行）

### Phase 3: Mastra導入

**タイミング**: MVP完成 + デモ成功後

**移行内容**:

1. Mastra Agent化
   - 現在のGemini統合 → Mastra Agentに置き換え
   - Function Callingの拡張

2. 音声会話追加
   - TTS（Text-to-Speech）
   - STT（Speech-to-Text）
   - リップシンク実装

3. RAG統合
   - 社内ドキュメント検索
   - ベクトルDB構築

4. 画像認識
   - カメラ入力からの画像解析
   - 物体認識 → 会話連動

**所要時間**: 3-5日

---

## 実装チェックリスト

### Day 1（6-8時間）

- [ ] チャットUI実装（HTML/CSS/JS）
- [ ] ChatControllerクラス実装
- [ ] バックエンドAPIエンドポイント作成
- [ ] Gemini API Structured Output実装
- [ ] ローカルテスト

### Day 2（6-8時間）

- [ ] VRMアニメーションコントローラー実装
- [ ] 7種類のアニメーション事前ロード
- [ ] 感情 → モーション切り替え実装
- [ ] @pixiv/three-vrm表情統合
- [ ] 統合テスト（フロント + バック）

### Day 3（4-6時間）

- [ ] エラーハンドリング追加
- [ ] レスポンシブ対応
- [ ] パフォーマンス最適化
- [ ] B2Bデモリハーサル
- [ ] ドキュメント更新

---

## 開発開始

準備が整いました。Phase 2 MVP完成に向けて開発を開始してください。
