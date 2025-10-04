/**
 * Vercel Serverless Function: /api/chat
 * 
 * シンプルなAPIエンドポイント実装
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleFunctionCalling } from '../server/services/gemini.service';
import type { ChatRequest, ChatResponse } from '../server/types/chat.types';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // OPTIONSリクエスト（CORS preflight）
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // POSTのみ許可
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const { message, oauthToken } = req.body as ChatRequest;

    if (!message) {
      res.status(400).json({ error: 'メッセージが必要です' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error('[API] GEMINI_API_KEYが設定されていません');
      res.status(500).json({
        error: 'サーバー設定エラー',
        message: 'API設定が不足しています。管理者に連絡してください。',
        emotion: 'sad'
      });
      return;
    }

    console.log('[API] ユーザーメッセージ:', message);

    const result = await handleFunctionCalling(
      process.env.GEMINI_API_KEY,
      message,
      oauthToken || null
    );

    console.log('[API] Gemini応答:', result);

    const response: ChatResponse = {
      message: result.text,
      emotion: result.emotion,
      timestamp: new Date()
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('[API] エラー:', error);
    res.status(500).json({
      error: 'サーバーエラーが発生しました',
      message: 'すみません、エラーが発生しました。',
      emotion: 'sad'
    });
  }
}

