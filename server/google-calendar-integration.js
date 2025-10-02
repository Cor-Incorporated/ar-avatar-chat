import { GoogleGenAI, Type } from '@google/genai';
import { google } from 'googleapis';

// レスポンススキーマの定義
const responseSchema = {
  type: 'object',
  properties: {
    message: {
      type: 'string',
      description: '博多弁での応答メッセージ',
    },
    emotion: {
      type: 'string',
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
    parametersJsonSchema: {
      type: 'object',
      properties: {
        date_range: {
          type: 'string',
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
export async function handleFunctionCalling(apiKey, userPrompt, oauthToken) {
  const ai = new GoogleGenAI({ apiKey });

  // まずStructured Outputで直接応答を試みる（Function Calling不要の場合）
  const directResponse = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: userPrompt,
    config: {
      responseModalities: ['TEXT'],
      responseMimeType: 'application/json',
      responseSchema: responseSchema,
      systemInstruction: HAKATA_CHARACTER_INSTRUCTION,
      temperature: 0.5,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 1024,
    }
  });

  try {
    const parsedResponse = JSON.parse(directResponse.text);
    return {
      message: parsedResponse.message,
      emotion: parsedResponse.emotion
    };
  } catch (parseError) {
    // JSON解析失敗 - Function Callingが必要かもしれない
    console.log('[Info] Structured Outputのみでは不十分、Function Calling試行');
  }

  // Function Calling対応（Structured OutputなしのAPIコール）
  const fcResponse = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: userPrompt,
    config: {
      systemInstruction: HAKATA_CHARACTER_INSTRUCTION,
      tools: [{ functionDeclarations }],
      temperature: 0.5,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 1024,
    }
  });

  let iteration = 0;
  const MAX_ITERATIONS = 5;
  let currentResponse = fcResponse;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const functionCalls = currentResponse.functionCalls;

    if (!functionCalls || functionCalls.length === 0) {
      // Function Call不要 - テキストから感情を抽出
      const text = currentResponse.text;

      // Structured Outputで再フォーマット
      const formattedResponse = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `以下のテキストをJSON形式に変換してください: ${text}`,
        config: {
          responseModalities: ['TEXT'],
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
          systemInstruction: HAKATA_CHARACTER_INSTRUCTION,
          temperature: 0.5,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 1024,
        }
      });

      try {
        const parsedResponse = JSON.parse(formattedResponse.text);
        return {
          message: parsedResponse.message,
          emotion: parsedResponse.emotion
        };
      } catch (parseError) {
        console.error('[Parse Error]:', parseError);
        return {
          message: text || "応答の解析に失敗しました。",
          emotion: "neutral"
        };
      }
    }

    // Function Callsの処理
    const functionResponses = [];
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

      functionResponses.push({
        name: functionName,
        response: functionResult
      });
    }

    // Function結果を受け取った後、Structured Outputで最終応答を生成
    const finalResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `ユーザーの質問: ${userPrompt}\n\nカレンダー情報: ${JSON.stringify(functionResponses[0].response)}\n\n上記の情報に基づいて博多弁で応答してください。`,
      config: {
        responseModalities: ['TEXT'],
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        systemInstruction: HAKATA_CHARACTER_INSTRUCTION,
        temperature: 0.5,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
      }
    });

    try {
      const parsedResponse = JSON.parse(finalResponse.text);
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

  return {
    message: "処理が複雑すぎました。もう一度お試しください。",
    emotion: "neutral"
  };
}
