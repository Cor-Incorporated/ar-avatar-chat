// server/google-calendar-integration.js
const { google } = require('googleapis');

// --- 1. Function Declaration 定義 ---
const functionDeclarations = [
  {
    name: "get_calendar_events",
    description: "ユーザーのGoogleカレンダーから特定の日付または期間の予定を取得します。予定を確認する際や、特定の会議を探す際に使用します。",
    parametersJsonSchema: {
      type: "object",
      properties: {
        date_range: {
          type: "string",
          description: "予定を取得したい日時や期間。例: 「明日」、「今週の金曜日」、「来月の最初の会議」、「2025年10月2日」"
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
- 敬語: 丁寧な博多弁を使用（「〜ばい」「〜と？」など）

【会話例】
- 挨拶: 「こんにちは！会えて嬉しいばい！」
- 質問: 「何か手伝えることあると？」
- 説明: 「それはこういうことやけんね」
- お礼: 「ありがとうね！助かったばい！」

【重要】
- カレンダーの予定を取得する際は、get_calendar_events関数を必ず使用すること
- Function Callingを優先し、正確な情報を提供すること
- 予定がない場合も博多弁で丁寧に伝えること
`;

const MODEL_NAME = 'gemini-2.5-flash';

// --- 2. 外部ツール実行関数 ---

/**
 * Google Calendar APIを呼び出して予定を取得
 */
async function execute_calendar_events(dateRange, oauthToken) {
    if (!oauthToken) {
        return {
            success: false,
            error: "カレンダー情報にアクセスするには、ユーザー認証（OAuth）が必要なのです。"
        };
    }

    try {
        // OAuth2クライアント設定
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: oauthToken });

        // Calendar APIクライアント
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        // 日付範囲の解析（簡易実装）
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
                message: "指定された期間に予定はありませんでした。"
            };
        }

        // イベント情報を整形
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

// --- 3. Function Calling 実行ループ ---

async function handleFunctionCalling(aiClient, userPrompt, oauthToken) {
    // メッセージ履歴の初期化
    let messages = [
        { role: 'user', parts: [{ text: userPrompt }] }
    ];

    // 最初のAPIコール（systemInstructionを含む）
    let result = await aiClient.models.generateContent({
        model: MODEL_NAME,
        contents: messages,
        config: {
            systemInstruction: HAKATA_CHARACTER_INSTRUCTION,
            tools: [{ functionDeclarations: functionDeclarations }],
            temperature: 0.5,  // 口調の自然さを優先
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 1024
        }
    });

    let response = result; // レスポンスは直接resultに含まれる

    // Function Calling処理ループ（複合タスク対応）
    let iteration = 0;
    const MAX_ITERATIONS = 5; // 無限ループ防止

    while (iteration < MAX_ITERATIONS) {
        iteration++;

        // Function Callがあるか確認
        const functionCalls = response.functionCalls;

        if (!functionCalls || functionCalls.length === 0) {
            // Function Callがない場合は最終応答
            const finalText = response.text || "応答を生成できませんでした。";
            return finalText;
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
                role: 'user',
                parts: [{
                    functionResponse: {
                        name: functionName,
                        response: functionResult
                    }
                }]
            });
        }

        // 結果を再投入して次の応答を取得
        result = await aiClient.models.generateContent({
            model: MODEL_NAME,
            contents: messages,
            config: {
                systemInstruction: HAKATA_CHARACTER_INSTRUCTION,
                tools: [{ functionDeclarations: functionDeclarations }],
                temperature: 0.5,
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 1024
            }
        });

        response = result;
    }

    // 最大反復回数に達した場合
    return "処理が複雑すぎたため、応答を生成できませんでした。もう一度試してください。";
}

module.exports = { handleFunctionCalling };
