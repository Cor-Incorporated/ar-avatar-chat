import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { handleFunctionCalling } from './services/gemini.service.js';
import dotenv from 'dotenv';
import type { ChatRequest, ChatResponse } from './types/chat.types.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.post('/api/chat', async (req: Request<{}, ChatResponse, ChatRequest>, res: Response<ChatResponse | { error: string; message?: string; emotion?: string }>) => {
  try {
    const { message, oauthToken } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'メッセージが必要です' });
    }

    console.log('[API] ユーザーメッセージ:', message);

    const result = await handleFunctionCalling(
      process.env.GEMINI_API_KEY!,
      message,
      oauthToken || null
    );

    console.log('[API] Gemini応答:', result);

    res.json({
      message: result.text,
      emotion: result.emotion,
      timestamp: new Date()
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
