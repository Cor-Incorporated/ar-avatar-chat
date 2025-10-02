# 技術調査: Gemini Structured Output & VRM表情制御

**調査日**: 2025年10月2日  
**目的**: Geminiの感情抽出とVRM表情制御の確実な実装方法を確認

---

## 1. Gemini Structured Output

### 概要

Gemini 1.5 Flash以降は**Structured Output**機能をサポートしており、`response_mime_type`と`response_schema`を使用して確実にJSON形式の出力を得られます。

**従来の問題点**:
- `[EMOTION: happy]`のようなタグ形式は不安定
- プロンプトエンジニアリングに依存
- パース失敗のリスク

**Structured Outputの利点**:
- ✅ 確実なJSON出力
- ✅ スキーマ検証
- ✅ 型安全
- ✅ パース不要

### 実装例（Node.js / @google/genai）

```javascript
const { GoogleGenerativeAI, SchemaType } = require('@google/genai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: responseSchema,
  },
  systemInstruction: HAKATA_CHARACTER_INSTRUCTION,
});

// プロンプト送信
const result = await model.generateContent('こんにちは！');

// パース（確実にJSONが返る）
const parsedResponse = JSON.parse(result.response.text());

console.log(parsedResponse);
// {
//   "message": "こんにちは！会えて嬉しいばい！",
//   "emotion": "happy"
// }
```

### Function Calling との併用

Function Calling使用時もStructured Outputは併用可能です：

```javascript
async function handleFunctionCallingWithStructuredOutput(aiClient, userPrompt, oauthToken) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: responseSchema,
    },
    systemInstruction: HAKATA_CHARACTER_INSTRUCTION,
    tools: [{ functionDeclarations: functionDeclarations }],
  });

  // メッセージ履歴の初期化
  let messages = [
    { role: 'user', parts: [{ text: userPrompt }] }
  ];

  // 最初のAPIコール
  let result = await model.generateContent({
    contents: messages,
  });

  let response = result.response;

  // Function Calling処理ループ
  let iteration = 0;
  const MAX_ITERATIONS = 5;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    // Function Callがあるか確認
    const functionCalls = response.functionCalls();

    if (!functionCalls || functionCalls.length === 0) {
      // Function Callがない場合は最終応答（JSON形式）
      const finalText = response.text();
      const parsedResponse = JSON.parse(finalText);
      
      return {
        message: parsedResponse.message,
        emotion: parsedResponse.emotion
      };
    }

    // Function Callを実行
    for (const functionCall of functionCalls) {
      const functionName = functionCall.name;
      const args = functionCall.args;

      let functionResult;

      // 関数実行
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

      // 会話履歴に追加
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

    // 結果を再投入して次の応答を取得
    result = await model.generateContent({
      contents: messages,
    });

    response = result.response;
  }

  // 最大反復回数に達した場合
  return {
    message: "処理が複雑すぎたため、応答を生成できませんでした。",
    emotion: "neutral"
  };
}
```

---

## 2. @pixiv/three-vrm 表情制御

### 公式ドキュメントの確認

- **GitHub**: https://github.com/pixiv/three-vrm
- **API Reference**: https://pixiv.github.io/three-vrm/
- **Examples**: https://pixiv.github.io/three-vrm/packages/three-vrm/examples/

### VRM1.0での表情システム

VRM1.0では`BlendShapeProxy`が`Expressions`に改名されました：

```javascript
// VRM0.x (古い)
vrm.blendShapeProxy.setValue('happy', 1.0);

// VRM1.0 (新しい)
vrm.expressionManager.setValue('happy', 1.0);
```

### 表情の設定方法

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

  console.log(`[VRM Expression] 表情を設定: ${emotion}`);
}
```

### 表情のフェード効果

スムーズな表情切り替えのため、フェード効果を実装：

```javascript
class VRMExpressionController {
  constructor(vrm) {
    this.vrm = vrm;
    this.currentEmotion = 'neutral';
    this.targetEmotion = 'neutral';
    this.transitionProgress = 1.0; // 0〜1
    this.transitionDuration = 0.5; // 秒
  }

  /**
   * 表情を切り替え（フェード付き）
   */
  setEmotion(emotion) {
    if (this.currentEmotion === emotion) return;

    this.targetEmotion = emotion;
    this.transitionProgress = 0.0;
  }

  /**
   * 毎フレーム呼び出し
   */
  update(deltaTime) {
    if (this.transitionProgress < 1.0) {
      this.transitionProgress += deltaTime / this.transitionDuration;
      this.transitionProgress = Math.min(this.transitionProgress, 1.0);

      // イージング（easeInOutQuad）
      const t = this.transitionProgress;
      const easedT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      // 現在の表情と目標の表情をブレンド
      this.blendExpressions(this.currentEmotion, this.targetEmotion, easedT);

      if (this.transitionProgress >= 1.0) {
        this.currentEmotion = this.targetEmotion;
      }
    }
  }

  /**
   * 2つの表情をブレンド
   */
  blendExpressions(fromEmotion, toEmotion, t) {
    const expressionManager = this.vrm.expressionManager;

    const validExpressions = ['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised'];

    validExpressions.forEach(expr => {
      let value = 0;

      if (expr === fromEmotion) {
        value = 1.0 - t;
      } else if (expr === toEmotion) {
        value = t;
      }

      expressionManager.setValue(expr, value);
    });

    expressionManager.update();
  }
}

// 使用例
const expressionController = new VRMExpressionController(vrm);

// A-FrameのtickループでupdateWを呼ぶ
AFRAME.registerComponent('vrm-expression-updater', {
  tick: function(time, deltaTime) {
    if (window.vrmExpressionController) {
      window.vrmExpressionController.update(deltaTime / 1000);
    }
  }
});
```

---

## 3. 統合実装（推奨）

### システムアーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                       フロントエンド                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                     ChatUI                             │ │
│  │  ユーザー入力 → ChatController → バックエンドAPI       │ │
│  └────────────────────────────────────────────────────────┘ │
│                              ↓                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │            VRMアニメーション + 表情制御                 │ │
│  │  - AnimationMixer (モーション)                         │ │
│  │  - ExpressionManager (表情)                            │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                      バックエンド                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Gemini API (Structured Output)            │ │
│  │  - System Instruction (博多弁)                         │ │
│  │  - Function Calling (Calendar)                         │ │
│  │  - JSONスキーマ { message, emotion }                   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 感情 → アニメーション + 表情のマッピング

| 感情 | モーション | VRM表情 | 説明 |
|------|-----------|---------|------|
| `neutral` | VRMA_01.vrma | neutral | アイドル状態 |
| `happy` | VRMA_02.vrma | happy | 喜び・嬉しい |
| `angry` | VRMA_03.vrma | angry | 怒り・不満 |
| `sad` | VRMA_04.vrma | sad | 悲しみ・残念 |
| `relaxed` | VRMA_05.vrma | relaxed | リラックス |
| `surprised` | VRMA_06.vrma | surprised | 驚き |
| `thinking` | VRMA_07.vrma | neutral | 考え中 |

---

## 4. 実装コード（完全版）

### バックエンド: `server/google-calendar-integration.js`

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
あなたの応答には必ず以下の2つの要素を含めてください：
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
      // デフォルト: 今後1週間
      timeMin = now.toISOString();
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      timeMax = nextWeek.toISOString();
    }

    // Calendar API呼び出し
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

  // メッセージ履歴の初期化
  let messages = [
    { role: 'user', parts: [{ text: userPrompt }] }
  ];

  // 最初のAPIコール
  let result = await model.generateContent({
    contents: messages,
  });

  let response = result.response;

  // Function Calling処理ループ
  let iteration = 0;
  const MAX_ITERATIONS = 5;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    // Function Callがあるか確認
    const functionCalls = response.functionCalls();

    if (!functionCalls || functionCalls.length === 0) {
      // Function Callがない場合は最終応答（JSON形式）
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

    // Function Callを実行
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

      // 会話履歴に追加
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

    // 結果を再投入して次の応答を取得
    result = await model.generateContent({
      contents: messages,
    });

    response = result.response;
  }

  // 最大反復回数に達した場合
  return {
    message: "処理が複雑すぎました。もう一度お試しください。",
    emotion: "neutral"
  };
}

module.exports = { handleFunctionCalling };
```

---

## 5. 結論

### 推奨実装方針

1. ✅ **Gemini Structured Output を使用**
   - `response_mime_type: "application/json"`
   - `response_schema`で感情を確実に取得
   - `[EMOTION: xxx]`タグは不要

2. ✅ **@pixiv/three-vrmの表情制御**
   - `vrm.expressionManager.setValue(emotion, 1.0)`
   - フェード効果で自然な切り替え

3. ✅ **アニメーション + 表情の同時制御**
   - モーション（AnimationMixer）
   - 表情（ExpressionManager）
   - 両方を連動させる

### 次のステップ

1. 開発指示書を修正（Structured Output対応）
2. バックエンドの実装（上記コード使用）
3. フロントエンドの統合
4. テスト・検証

この方針で実装を進めれば、確実で安定した動作が期待できます。
