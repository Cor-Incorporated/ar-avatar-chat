import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { handleFunctionCalling } from './services/gemini.service.js';
import dotenv from 'dotenv';
import type { ChatRequest, ChatResponse } from './types/chat.types.js';
import { allowChatRequest } from './services/rate-limit.service.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '8mb' }));

app.post('/api/chat', async (req: Request<{}, ChatResponse, ChatRequest>, res: Response<ChatResponse | { error: string; message?: string; emotion?: string }>) => {
  try {
    if (!allowChatRequest(req.ip || 'unknown')) return res.status(429).json({ error: 'リクエストが多すぎます', message: '少し時間をおいて試してね。', emotion: 'sad' });
    const { message, timezone, attachments, conversationHistory } = req.body;
    const normalizedMessage = message?.trim() || '';
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

    if (!normalizedMessage && !hasAttachments) {
      return res.status(400).json({ error: 'メッセージまたは画像が必要です' });
    }

    console.log('[API] ユーザーメッセージ:', normalizedMessage || '画像のみ');

    const result = await handleFunctionCalling(
      process.env.GEMINI_API_KEY!,
      normalizedMessage,
      attachments || [],
      conversationHistory || [],
      undefined,
      timezone || 'Asia/Tokyo'
    );

    console.log('[API] Gemini応答:', result);

    res.json({
      message: result.text,
      emotion: result.emotion,
      timestamp: new Date(),
      action: result.action,
      calendar: result.calendar
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
