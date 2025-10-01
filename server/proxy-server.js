// server/proxy-server.js
require('dotenv').config();
const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const bodyParser = require('body-parser');
const cors = require('cors');

// Gemini APIクライアント初期化
// GEMINI_API_KEYは環境変数から自動取得される
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

// Calendar連携モジュール（ステップ3で作成）
const { handleFunctionCalling } = require('./google-calendar-integration');

// OAuth認証ハンドラー
const { getAuthUrl, getTokenFromCode } = require('./oauth-handler');

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア設定
app.use(bodyParser.json());
app.use(cors()); // 開発環境用（本番では特定ドメインのみ許可）

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Proxy Server is running' });
});

// メインチャットエンドポイント
app.post('/api/gemini/chat', async (req, res) => {
    const userPrompt = req.body.prompt;

    if (!userPrompt) {
        return res.status(400).json({
            success: false,
            message: 'Prompt is required.'
        });
    }

    // クライアントから渡されたOAuthトークンを取得
    const authHeader = req.headers.authorization;
    const userOAuthToken = authHeader ? authHeader.split(' ')[1] : null;

    // リクエストログ（本番環境では適切なロギングサービスに置き換え）
    console.log('[Request] User Prompt:', userPrompt);
    console.log('[Auth] OAuth Token:', userOAuthToken ? 'Present' : 'Not provided');

    try {
        // Function Callingの実行ループを開始
        const finalResponseText = await handleFunctionCalling(
            ai,
            userPrompt,
            userOAuthToken
        );

        console.log('[Response] Generated successfully');

        // 最終応答をクライアントに返す
        res.json({
            success: true,
            responseText: finalResponseText
        });

    } catch (error) {
        console.error('[Error] Function Calling Loop:', error.message);

        // レート制限エラーの処理
        if (error.message.includes('Rate limit exceeded') ||
            error.message.includes('429')) {
            return res.status(429).json({
                success: false,
                message: 'APIレート制限に達しました。しばらく待ってから再試行してください。'
            });
        }

        // その他のエラー
        res.status(500).json({
            success: false,
            message: 'サーバー内部エラーが発生しました。詳細はサーバーログを確認してください。'
        });
    }
});

// OAuth認証開始エンドポイント
app.get('/auth/google', (req, res) => {
    const authUrl = getAuthUrl();
    res.redirect(authUrl);
});

// OAuthコールバックエンドポイント
app.get('/oauth2callback', async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.status(400).send('Authorization code not found');
    }

    try {
        const tokens = await getTokenFromCode(code);

        // トークンをクライアントに返す（実際はセッション管理推奨）
        res.send(`
            <html>
            <body>
                <h2>認証成功！</h2>
                <p>以下のトークンをコピーしてクライアントに使用してください:</p>
                <textarea style="width:100%; height:200px;">${tokens.access_token}</textarea>
                <script>
                    // トークンをlocalStorageに保存（開発用）
                    localStorage.setItem('google_access_token', '${tokens.access_token}');
                    alert('トークンが保存されました');
                    window.close();
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('OAuth Token Error:', error);
        res.status(500).send('Token exchange failed');
    }
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`================================`);
    console.log(`Proxy Server running on:`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`================================`);
    console.log(`Endpoints:`);
    console.log(`  GET  /health`);
    console.log(`  POST /api/gemini/chat`);
    console.log(`  GET  /auth/google`);
    console.log(`  GET  /oauth2callback`);
    console.log(`================================`);
});
