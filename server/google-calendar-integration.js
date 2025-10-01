// server/google-calendar-integration.js
const { google } = require('googleapis');

// --- 1. Function Declaration 定義 ---
const functionDeclarations = [
  {
    name: "get_calendar_events",
    description: "ユーザーのGoogleカレンダーから特定の日付または期間の予定を取得します。予定を確認する際や、特定の会議を探す際に使用します。",
    parameters: {
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

// VRoid口調を実現するためのSystem Instruction
// 注意: Gemini APIのsystemInstructionパラメータは期待通りに動作しないため、
// 以下の定義はドキュメント目的のみで、実際にはFew-shot examplesで実装しています
const VRM_CHARACTER_STYLE = `
VRoidキャラクターの口調ルール:
- 語尾: 「〜なのです」「〜なのですね」を使用
- 一人称: 「私」
- 二人称: 「あなた」「〜さん」
- スタイル: 明るく、親しみやすく、可愛らしい
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
    // 会話履歴の初期化（Few-shot examplesで口調を学習）
    // Gemini APIのsystemInstructionは期待通りに動作しないため、
    // 代わりにユーザー・モデルの会話例を使用してVRoid口調を実現
    let messages = [
        // Example 1: 挨拶
        { role: 'user', parts: [{ text: 'こんにちは' }] },
        { role: 'model', parts: [{ text: 'こんにちは！お会いできて嬉しいのです！今日は何かお手伝いできることはありますか？' }] },
        // Example 2: 自己紹介
        { role: 'user', parts: [{ text: 'あなたは誰？' }] },
        { role: 'model', parts: [{ text: '私はあなたのアシスタントなのです！何でも気軽に聞いてくださいね！' }] },
        // Example 3: お礼
        { role: 'user', parts: [{ text: 'ありがとう' }] },
        { role: 'model', parts: [{ text: 'どういたしまして！お役に立てて嬉しいのです。他に何かあれば声をかけてくださいね！' }] },
        // Example 4: カレンダー関連の質問
        { role: 'user', parts: [{ text: '明日の予定を教えて' }] },
        { role: 'model', parts: [{ text: 'かしこまりました！明日のご予定を確認するのですね。少々お待ちくださいませ！' }] },
        // Example 5: できないことの説明
        { role: 'user', parts: [{ text: '天気は？' }] },
        { role: 'model', parts: [{ text: '申し訳ないのです！天気の情報は取得できないのですが、カレンダーの予定ならお調べできますよ！' }] },
        // 実際のユーザープロンプト
        { role: 'user', parts: [{ text: userPrompt }] }
    ];

    // モデル設定（temperature低下で一貫性向上）
    const generationConfig = {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
    };

    // 最初のAPIコール
    let result = await aiClient.models.generateContent({
        model: MODEL_NAME,
        contents: messages,
        tools: [{ functionDeclarations: functionDeclarations }],
        generationConfig: generationConfig
    });

    let response = result; // レスポンスは直接resultに含まれる

    // Function Calling処理ループ（複合タスク対応）
    let iteration = 0;
    const MAX_ITERATIONS = 5; // 無限ループ防止

    while (iteration < MAX_ITERATIONS) {
        iteration++;
        console.log(`[Function Calling Loop] Iteration ${iteration}`);

        // Function Callがあるか確認
        const functionCalls = response.candidates?.[0]?.content?.parts?.filter(
            part => part.functionCall
        );

        if (!functionCalls || functionCalls.length === 0) {
            // Function Callがない場合は最終応答
            const finalText = response.candidates?.[0]?.content?.parts
                ?.filter(part => part.text)
                ?.map(part => part.text)
                ?.join('') || "応答を生成できませんでした。";

            return finalText;
        }

        // Function Callを実行
        for (const part of functionCalls) {
            const functionCall = part.functionCall;
            const functionName = functionCall.name;
            const args = functionCall.args;

            console.log(`[Function Call] ${functionName}`, args);

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

            console.log(`[Function Result]`, functionResult);

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
            tools: [{ functionDeclarations: functionDeclarations }],
            generationConfig: generationConfig
        });

        response = result; // レスポンスは直接resultに含まれる
    }

    // 最大反復回数に達した場合
    return "処理が複雑すぎたため、応答を生成できませんでした。もう一度試してください。";
}

module.exports = { handleFunctionCalling };
