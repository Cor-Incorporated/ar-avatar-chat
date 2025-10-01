# 開発指示書 Phase 2 - LLM統合
## Gemini 2.5 Flash + Google Calendar連携

**発行日**: 2025-10-01  
**発行者**: PdM 寺田康佑  
**対象**: 開発チーム  
**期限**: Phase 1完了後 4営業日  
**前提条件**: Phase 1完了、Tier 2 APIキー保有済み

---

## 📌 Phase 2の目標

AR環境にAI会話機能を追加し、Gemini 2.5 Flashを使った自然な日本語対話とGoogle Calendar連携を実現します。

### 成果物
- **サーバー**: Node.js Expressプロキシサーバー
- **クライアント**: チャットUI統合済みAR環境
- **動作**: 「明日の予定は？」→ Calendar連携 → VRoid口調で応答

---

## ⚠️ 重要な注意事項

### やってはいけないこと
❌ **APIキーをクライアントに埋め込む** → セキュリティリスク  
❌ 指示書と異なるアーキテクチャにする  
❌ OAuth認証を省略する  
❌ リサーチャーのコードを大幅に改変する（動作確認済み）

### 必ずやること
✅ **プロキシサーバーを構築** → APIキー保護  
✅ **環境変数でAPIキー管理** → `.env`ファイル使用  
✅ **OAuth 2.0実装** → Calendar API連携  
✅ **エラーハンドリング実装** → レート制限対策

---

## 🚀 ステップ1: 環境セットアップ（Day 1午前）

### 1-1. サーバーディレクトリ作成

**指示**: プロジェクトにサーバー用のディレクトリを作成してください。

```bash
cd /Users/teradakousuke/Developer/ar-avatar-chat
mkdir server
cd server
```

### 1-2. Node.jsプロジェクト初期化

**指示**: `package.json`を作成し、必要な依存関係をインストールしてください。

```bash
npm init -y
npm install express dotenv @google/genai googleapis body-parser cors
```

**インストールされるパッケージ**:
- `express`: Webサーバーフレームワーク
- `dotenv`: 環境変数管理
- `@google/genai`: Gemini API公式SDK
- `googleapis`: Google Calendar API
- `body-parser`: JSONリクエスト処理
- `cors`: CORS設定

### 1-3. 環境変数ファイル作成

**指示**: `server/.env`ファイルを作成してください。

```bash
# server/.env
GEMINI_API_KEY=your_tier2_api_key_here
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
PORT=3000
```

**⚠️ セキュリティ**: `.env`ファイルを`.gitignore`に追加してください。

```bash
# .gitignore に追加
echo "server/.env" >> .gitignore
echo "server/node_modules" >> .gitignore
```

**提出物**: `.env.example`ファイルも作成し、キーの形式を示してください。

```bash
# server/.env.example
GEMINI_API_KEY=AIza...（Tier 2キー）
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
PORT=3000
```

### 1-4. ディレクトリ構成確認

**完了時の構成**:
```
ar-avatar-chat/
├── server/                  # 新規作成
│   ├── package.json
│   ├── .env
│   ├── .env.example
│   └── node_modules/
├── src/ (Phase 1で作成済み)
└── docs/
```

**✅ 完了条件**:
- [ ] `server/` ディレクトリが作成されている
- [ ] 必要なnpmパッケージがインストールされている
- [ ] `.env` ファイルが作成され、APIキーが設定されている
- [ ] `.gitignore` に `.env` が追加されている

---

## 🎯 ステップ2: プロキシサーバー構築（Day 1午後）

### 2-1. メインサーバーファイル作成

**指示**: `server/proxy-server.js` を以下の内容で作成してください。

**注意**: このコードはリサーチャーが動作確認済みです。コピーして使用してください。

```javascript
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

    console.log('[Request] User Prompt:', userPrompt);
    console.log('[Auth] OAuth Token:', userOAuthToken ? 'Present' : 'Not provided');

    try {
        // Function Callingの実行ループを開始
        const finalResponseText = await handleFunctionCalling(
            ai, 
            userPrompt, 
            userOAuthToken
        );
        
        console.log('[Response] Final text:', finalResponseText);
        
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

// サーバー起動
app.listen(PORT, () => {
    console.log(`================================`);
    console.log(`Proxy Server running on:`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`================================`);
    console.log(`Endpoints:`);
    console.log(`  GET  /health`);
    console.log(`  POST /api/gemini/chat`);
    console.log(`================================`);
});
```

### 2-2. サーバー起動テスト

**指示**: サーバーを起動して、正常に動作することを確認してください。

```bash
cd server
node proxy-server.js
```

**期待される出力**:
```
================================
Proxy Server running on:
  http://localhost:3000
================================
Endpoints:
  GET  /health
  POST /api/gemini/chat
================================
```

**動作確認**:
```bash
# 別のターミナルで実行
curl http://localhost:3000/health
```

**期待される応答**:
```json
{"status":"ok","message":"Proxy Server is running"}
```

**✅ 完了条件**:
- [ ] `proxy-server.js` が作成されている
- [ ] サーバーが起動する
- [ ] `/health` エンドポイントが応答する
- [ ] エラーが出ていない

---

## 🔗 ステップ3: Function Calling実装（Day 1午後〜Day 2）

### 3-1. Google Calendar統合ファイル作成

**指示**: `server/google-calendar-integration.js` を以下の内容で作成してください。

**注意**: このコードはリサーチャーが動作確認済みです。

```javascript
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

// システムプロンプト (VRoidキャラ風の口調を維持)
// ⚠️ 重要: Gemini APIのsystemInstructionは期待通りに動作しないため、
// Few-shot examplesを含む最初のメッセージとして実装します
const MODEL_NAME = 'gemini-2.5-flash-preview-0514';

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
    // VRoid口調を定義するためのFew-shot examples
    // systemInstructionは期待通りに動作しないため、最初のメッセージとして追加
    const vroidStylePrompt = `あなたはVRoidキャラクターです。以下の例を参考に、必ず語尾に「〜なのです」「〜なのですね」を使って返答してください。

例1:
Q: こんにちは！
A: こんにちは！お会いできて嬉しいのです！今日は何かお手伝いできることはありますか？

例2:
Q: 明日の予定は？
A: 明日の予定を確認するのですね！少々お待ちくださいなのです。

例3:
Q: ありがとう！
A: どういたしましてなのです！また何かあればお声がけくださいなのですね！

例4:
Q: 今日の天気は？
A: 今日の天気についてお答えするのですね！具体的な場所の情報があればより正確にお答えできるのです。

例5:
Q: 予定を追加して
A: 予定の追加をお手伝いするのですね！どのような予定を追加したいのですか？

それでは、以下のユーザーの質問に答えてください：
${userPrompt}`;

    // 会話履歴の初期化（Few-shot examplesを含む）
    let messages = [
        { role: 'user', parts: [{ text: vroidStylePrompt }] }
    ];

    // モデル設定（Temperatureを下げて一貫性を向上）
    const generationConfig = {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
    };

    // 最初のAPIコール（systemInstructionは使用しない）
    let result = await aiClient.models.generateContent({
        model: MODEL_NAME,
        contents: messages,
        tools: [{ functionDeclarations: functionDeclarations }],
        generationConfig: generationConfig
    });

    let response = result.response;
    
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
        // systemInstructionは使用せず、会話履歴のみで継続
        result = await aiClient.models.generateContent({
            model: MODEL_NAME,
            contents: messages,
            tools: [{ functionDeclarations: functionDeclarations }],
            generationConfig: generationConfig
        });
        
        response = result.response;
    }
    
    // 最大反復回数に達した場合
    return "処理が複雑すぎたため、応答を生成できませんでした。もう一度試してください。";
}

module.exports = { handleFunctionCalling };
```

### 3-2. 動作確認（モックテスト）

**指示**: サーバーを再起動し、Function Callingをテストしてください。

```bash
# サーバー再起動
cd server
node proxy-server.js
```

**テストリクエスト**（別ターミナル）:
```bash
curl -X POST http://localhost:3000/api/gemini/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "こんにちは！"}'
```

**期待される応答**:
```json
{
  "success": true,
  "responseText": "こんにちは！お会いできて嬉しいのです！何かお手伝いできることはありますか？"
}
```

**✅ 完了条件**:
- [ ] `google-calendar-integration.js` が作成されている
- [ ] サーバーが正常に起動する
- [ ] `/api/gemini/chat` エンドポイントが応答する
- [ ] VRoid風の口調で応答が返ってくる

---

## 🔐 ステップ4: OAuth 2.0設定（Day 2午後）

### 4-1. Google Cloud Console設定

**指示**: Google Cloud Consoleで OAuth 2.0を設定してください。

#### A. Google Cloud Projectの作成/選択
1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを作成または既存のプロジェクトを選択

#### B. Google Calendar APIの有効化
1. 「APIとサービス」→「ライブラリ」
2. 「Google Calendar API」を検索
3. 「有効にする」をクリック

#### C. OAuth同意画面の設定
1. 「APIとサービス」→「OAuth同意画面」
2. ユーザータイプ: **外部**（テスト用）
3. 必須項目を入力:
   - アプリ名: `ARアバターチャット`
   - ユーザーサポートメール: あなたのメール
   - 開発者連絡先: あなたのメール
4. スコープを追加:
   - `../auth/calendar.readonly`

#### D. OAuthクライアントIDの作成
1. 「APIとサービス」→「認証情報」
2. 「認証情報を作成」→「OAuthクライアントID」
3. アプリケーションの種類: **Webアプリケーション**
4. 名前: `ARアバターチャット`
5. **承認済みのリダイレクトURI**を追加:
   ```
   http://localhost:3000/oauth2callback
   ```
6. 「作成」をクリック
7. **クライアントIDとシークレット**をコピーして、`.env`ファイルに貼り付け

### 4-2. .envファイル更新

```bash
# server/.env
GEMINI_API_KEY=your_tier2_api_key_here
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com  # ← コピーしたID
GOOGLE_CLIENT_SECRET=GOCSPX-xxx  # ← コピーしたシークレット
PORT=3000
```

### 4-3. OAuth認証フロー実装

**指示**: `server/oauth-handler.js` を作成してください。

```javascript
// server/oauth-handler.js
const { google } = require('googleapis');
require('dotenv').config();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3000/oauth2callback'
);

// スコープ定義
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

// 認証URLを生成
function getAuthUrl() {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    return authUrl;
}

// 認証コードからトークンを取得
async function getTokenFromCode(code) {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
}

module.exports = {
    getAuthUrl,
    getTokenFromCode,
    oauth2Client
};
```

### 4-4. proxy-server.jsにOAuth認証エンドポイント追加

**指示**: `proxy-server.js`に以下のエンドポイントを追加してください。

```javascript
// proxy-server.js に追加

const { getAuthUrl, getTokenFromCode } = require('./oauth-handler');

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
```

### 4-5. OAuth認証テスト

**指示**: サーバーを再起動し、OAuth認証フローをテストしてください。

```bash
# サーバー再起動
node proxy-server.js
```

**ブラウザでアクセス**:
```
http://localhost:3000/auth/google
```

**手順**:
1. Googleアカウントでログイン
2. Calendar APIへのアクセスを許可
3. トークンが表示されることを確認

**✅ 完了条件**:
- [ ] OAuth認証フローが完了する
- [ ] トークンが取得できる
- [ ] トークンをコピーして保存できる

---

## 🎨 ステップ5: クライアント統合（Day 3）

### 5-1. チャットUIの追加

**指示**: `src/index.html`にチャットUIを追加してください。

**追加場所**: `<body>`タグ内、`<a-scene>`の後

```html
<!-- チャットUI -->
<div id="chat-container" style="
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: 90%;
    max-width: 600px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 10px;
    padding: 15px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    z-index: 1000;
    display: none;
">
    <div id="chat-log" style="
        max-height: 200px;
        overflow-y: auto;
        margin-bottom: 10px;
        padding: 10px;
        background: #f5f5f5;
        border-radius: 5px;
    ">
        <p style="color: #666; font-size: 14px;">🐧 VRoidアバターと会話してみましょう！</p>
    </div>
    
    <div style="display: flex; gap: 10px;">
        <input 
            type="text" 
            id="chat-input" 
            placeholder="メッセージを入力..." 
            style="
                flex: 1;
                padding: 10px;
                border: 2px solid #ddd;
                border-radius: 5px;
                font-size: 14px;
            "
        />
        <button id="send-btn" style="
            padding: 10px 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
        ">送信</button>
    </div>
    
    <button id="auth-btn" style="
        margin-top: 10px;
        padding: 8px 16px;
        background: #1a73e8;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 12px;
    ">📅 Googleカレンダーを連携</button>
</div>
```

### 5-2. チャットハンドラーの実装

**指示**: `src/components/chat-handler.js`を作成してください。

```javascript
// src/components/chat-handler.js

AFRAME.registerComponent('chat-handler', {
    init: function() {
        console.log('[Chat Handler] Initialized');
        
        // DOM要素の取得
        this.chatContainer = document.getElementById('chat-container');
        this.chatLog = document.getElementById('chat-log');
        this.chatInput = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('send-btn');
        this.authBtn = document.getElementById('auth-btn');
        
        // OAuth Token管理
        this.accessToken = localStorage.getItem('google_access_token') || null;
        
        // イベントリスナー設定
        this.setupEventListeners();
        
        // マーカー検出時にチャットUIを表示
        const marker = document.querySelector('#marker');
        if (marker) {
            marker.addEventListener('markerFound', () => {
                console.log('[Chat Handler] Marker found, showing chat UI');
                this.chatContainer.style.display = 'block';
            });
        }
    },
    
    setupEventListeners: function() {
        // 送信ボタン
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        
        // Enterキーで送信
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
        
        // Google Calendar認証ボタン
        this.authBtn.addEventListener('click', () => {
            window.open('http://localhost:3000/auth/google', '_blank', 'width=600,height=700');
            // ポップアップが閉じた後、トークンを再取得
            setTimeout(() => {
                this.accessToken = localStorage.getItem('google_access_token');
                if (this.accessToken) {
                    this.addLogMessage('システム', 'Googleカレンダー連携が完了しました！', 'system');
                }
            }, 3000);
        });
    },
    
    async sendMessage() {
        const message = this.chatInput.value.trim();
        
        if (!message) return;
        
        // ユーザーメッセージを表示
        this.addLogMessage('あなた', message, 'user');
        this.chatInput.value = '';
        
        // ローディング表示
        this.addLogMessage('VRoid', '考え中...', 'loading');
        
        try {
            // プロキシサーバーにリクエスト
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // OAuth Tokenがあれば追加
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }
            
            const response = await fetch('http://localhost:3000/api/gemini/chat', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ prompt: message })
            });
            
            // ローディングメッセージを削除
            this.removeLoadingMessage();
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `エラー: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // VRoidの応答を表示
                this.addLogMessage('VRoid', data.responseText, 'bot');
            } else {
                this.addLogMessage('システム', data.message || 'エラーが発生しました', 'error');
            }
            
        } catch (error) {
            console.error('[Chat Handler] Error:', error);
            this.removeLoadingMessage();
            this.addLogMessage('システム', `エラー: ${error.message}`, 'error');
        }
    },
    
    addLogMessage: function(sender, text, type) {
        const messageDiv = document.createElement('div');
        messageDiv.style.marginBottom = '10px';
        messageDiv.setAttribute('data-message-type', type);
        
        let color = '#333';
        if (type === 'user') color = '#1a73e8';
        if (type === 'bot') color = '#4CAF50';
        if (type === 'system') color = '#666';
        if (type === 'error') color = '#f44336';
        if (type === 'loading') color = '#ff9800';
        
        messageDiv.innerHTML = `<strong style="color: ${color};">${sender}:</strong> ${text}`;
        
        this.chatLog.appendChild(messageDiv);
        this.chatLog.scrollTop = this.chatLog.scrollHeight;
    },
    
    removeLoadingMessage: function() {
        const loadingMsg = this.chatLog.querySelector('[data-message-type="loading"]');
        if (loadingMsg) {
            loadingMsg.remove();
        }
    }
});
```

### 5-3. index.htmlに統合

**指示**: `src/index.html`の`<head>`にchat-handlerを追加してください。

```html
<!-- チャットハンドラーコンポーネント -->
<script type="module" src="./components/chat-handler.js"></script>
```

**指示**: `<a-scene>`に`chat-handler`を追加してください。

```html
<a-scene
    embedded
    arjs="sourceType: webcam; debugUIEnabled: false;"
    vr-mode-ui="enabled: false"
    chat-handler
>
```

### 5-4. エンドツーエンドテスト

**手順**:
1. プロキシサーバーを起動: `cd server && node proxy-server.js`
2. クライアントを起動: Live Serverなど
3. ブラウザでアクセス
4. Hiroマーカーを検出
5. チャットUIが表示されることを確認
6. 「こんにちは！」と入力 → VRoid風の応答を確認
7. 「📅 Googleカレンダーを連携」ボタンをクリック → OAuth認証
8. 「明日の予定は？」と入力 → Calendar連携が動作することを確認

**✅ 完了条件**:
- [ ] マーカー検出時にチャットUIが表示される
- [ ] メッセージ送信が動作する
- [ ] VRoid風の応答が返ってくる
- [ ] OAuth認証が完了する
- [ ] Calendar連携が動作する

---

## 🧪 ステップ6: テストとデバッグ（Day 4）

### 6-1. 機能テスト

**テストケース**:

| No. | テスト内容 | 期待される結果 | 結果 |
|-----|-----------|--------------|------|
| 1 | 「こんにちは」 | VRoid風の挨拶 | ☐ |
| 2 | 「明日の予定は？」（認証前） | 認証を促すメッセージ | ☐ |
| 3 | OAuth認証完了 | トークン取得成功 | ☐ |
| 4 | 「明日の予定は？」（認証後） | Calendar連携成功 | ☐ |
| 5 | 「今日の天気は？」 | 通常の会話応答 | ☐ |
| 6 | 長文入力 | エラーなく応答 | ☐ |
| 7 | 連続5回送信 | レート制限なし（Tier 2） | ☐ |

### 6-2. エラーハンドリングテスト

**テストケース**:

| No. | エラーシナリオ | 期待される動作 | 結果 |
|-----|-------------|--------------|------|
| 1 | サーバー停止中 | エラーメッセージ表示 | ☐ |
| 2 | OAuth Token期限切れ | 再認証を促す | ☐ |
| 3 | 無効なAPIキー | サーバーエラー | ☐ |
| 4 | ネットワーク切断 | 適切なエラー表示 | ☐ |

### 6-3. パフォーマンステスト

**測定項目**:
- [ ] 応答時間: <2秒
- [ ] Function Calling成功率: >90%
- [ ] メモリリーク: なし

**測定方法**:
```javascript
// Chrome DevTools Console で実行
console.time('Response Time');
// メッセージ送信
// 応答受信後
console.timeEnd('Response Time');
```

---

## 📦 最終納品物

### コード
```
ar-avatar-chat/
├── server/
│   ├── package.json
│   ├── .env.example
│   ├── proxy-server.js
│   ├── google-calendar-integration.js
│   └── oauth-handler.js
├── src/
│   ├── index.html (チャットUI追加)
│   ├── components/
│   │   ├── vrm-loader.js
│   │   ├── vrm-animation.js
│   │   └── chat-handler.js (新規)
│   └── assets/ (既存)
```

### ドキュメント
- [ ] 動作確認レポート
- [ ] テスト結果
- [ ] 既知の問題リスト

---

## ⚠️ トラブルシューティング

### エラー: "GEMINI_API_KEY not found"
**原因**: 環境変数が読み込まれていない  
**解決**: `.env`ファイルの配置を確認し、サーバー再起動

### エラー: "Calendar API access denied"
**原因**: OAuth認証が未完了  
**解決**: 「📅 Googleカレンダーを連携」ボタンで認証

### エラー: "CORS policy blocked"
**原因**: クライアントとサーバーが異なるポート  
**解決**: `proxy-server.js`のCORS設定を確認

### 応答が遅い
**原因**: Function Calling実行による遅延  
**解決**: 正常な動作（目標<2秒は達成済み）

---

## 📞 問い合わせ

**PdM 寺田**
- Slack: @terada
- 対応時間: 平日 9:00-18:00

質問は遠慮なく！一緒に良いものを作りましょう 🚀

---

**最終更新**: 2025-10-01 by PdM 寺田康佑
