import { createTool } from '@mastra/core';
import { z } from 'zod';
import type { EmotionType, EmotionDetectionResult } from '../../types/emotion.types.js';

/**
 * 感情検出ツール
 * メッセージから感情を検出してVRMアニメーションを制御
 */
export const emotionTool = createTool({
  id: 'detect-emotion',
  description: 'メッセージから感情を検出してVRMアニメーションを制御',
  inputSchema: z.object({
    message: z.string().describe('応答メッセージ'),
    context: z.string().optional().describe('会話のコンテキスト')
  }),
  outputSchema: z.object({
    emotion: z.enum(['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised', 'thinking']),
    confidence: z.number().min(0).max(1),
    reason: z.string().optional()
  }),
  execute: async ({ context }) => {
    const { message, context: conversationContext } = context;

    // 感情検出ロジック（簡易版）
    const emotion = detectEmotion(message, conversationContext);

    const result: EmotionDetectionResult = {
      emotion,
      confidence: 0.85,
      reason: `Message analysis based on keywords and context`
    };

    return result;
  }
});

/**
 * キーワードベースの簡易感情検出
 */
function detectEmotion(message: string, context?: string): EmotionType {
  const lowerMessage = message.toLowerCase();

  // Happy keywords
  if (/嬉しい|楽しい|ありがと|良い|最高|素晴らしい/.test(lowerMessage)) {
    return 'happy';
  }

  // Angry keywords
  if (/怒り|腹立|イライラ|ムカつく|許せない/.test(lowerMessage)) {
    return 'angry';
  }

  // Sad keywords
  if (/悲しい|寂しい|残念|つらい|辛い|泣/.test(lowerMessage)) {
    return 'sad';
  }

  // Surprised keywords
  if (/驚|びっくり|すごい|まさか|えっ|！/.test(lowerMessage)) {
    return 'surprised';
  }

  // Relaxed keywords
  if (/リラックス|落ち着|平和|穏やか|のんびり/.test(lowerMessage)) {
    return 'relaxed';
  }

  // Thinking keywords
  if (/考え|思う|かな|だろう|かも|？/.test(lowerMessage)) {
    return 'thinking';
  }

  // Default
  return 'neutral';
}
