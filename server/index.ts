import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { handleFunctionCalling } from './services/gemini.service.js';
import dotenv from 'dotenv';
import type { ChatRequest, ChatResponse } from './types/chat.types.js';
import { allowChatRequest, normalizeClientIp } from './services/rate-limit.service.js';
import { createRequestContext, getGeminiModel } from './services/request-context.service.js';

dotenv.config();
getGeminiModel(process.env);

const app = express();
const PORT = process.env.PORT || 3000;

// The standalone Express server is expected behind one trusted edge proxy.
// Vercel uses api/chat.js, which validates its forwarded headers separately.
app.set('trust proxy', 1);
app.use(cors());
app.use(bodyParser.json({ limit: '8mb' }));

app.post('/api/chat', async (req: Request<{}, ChatResponse, ChatRequest>, res: Response<ChatResponse | { error: string; message?: string; emotion?: string }>) => {
  try {
    const clientKey = normalizeClientIp(req.ip) || 'unknown';
    if (!allowChatRequest(clientKey)) return res.status(429).json({ error: 'リクエストが多すぎます', message: '少し時間をおいて試してね。', emotion: 'sad' });
    const { message, timezone, attachments, conversationHistory } = req.body;
    const normalizedMessage = message?.trim() || '';
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

    if (!normalizedMessage && !hasAttachments) {
      return res.status(400).json({ error: 'メッセージまたは画像が必要です' });
    }

    console.log('[API] 入力メタデータ:', { messageLength: normalizedMessage.length, hasAttachments });
    let requestContext;
    try {
      requestContext = createRequestContext(new Date(), timezone || 'Asia/Tokyo');
    } catch {
      return res.status(400).json({ error: '未対応のタイムゾーンです', message: '日本時間で試してね。', emotion: 'sad' });
    }

    const result = await handleFunctionCalling(
      process.env.GEMINI_API_KEY!,
      normalizedMessage,
      attachments || [],
      conversationHistory || [],
      undefined,
      requestContext
    );

    console.log('[API] 応答メタデータ:', { emotion: result.emotion, hasCalendar: Boolean(result.calendar), hasAction: Boolean(result.action) });

    res.json({
      message: result.text,
      emotion: result.emotion,
      timestamp: requestContext.now,
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
