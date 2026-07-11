import { google } from '@ai-sdk/google';
import { generateText, Output, tool } from 'ai';
import { z } from 'zod';
import type { ChatAttachment, ConversationHistoryItem, GeminiResponse } from '../types/chat.types.js';
import type { CalendarProvider, CalendarResult } from '../types/calendar.types.js';
import { CalendarProviderError } from '../types/calendar.types.js';
import { isCalendarIntent, normalizeCalendarQuery } from './calendar-intent.service.js';
import { GoogleServiceAccountCalendarProvider } from './google-calendar.service.js';

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const emotionSchema = z.enum(['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised', 'thinking']);
const responseSchema = z.object({ message: z.string(), emotion: emotionSchema });

const SYSTEM = `あなたはCor.Inc.のAIアンバサダー、クラウディアです。明るく丁寧な博多弁で答えてください。
事実を推測で補わず、カレンダー情報が与えられた場合は、その公開情報だけに基づいて答えてください。
カレンダー取得失敗を認証設定の推測に言い換えないでください。`;

function historyMessages(history: ConversationHistoryItem[]) {
  return history.filter((turn) => turn.content?.trim()).slice(-20).map((turn) => ({ role: turn.role === 'model' ? 'assistant' as const : 'user' as const, content: turn.content }));
}

function userContent(prompt: string, attachments: ChatAttachment[], calendar?: CalendarResult) {
  const calendarContext = calendar ? `\n公開カレンダー情報(JSON): ${JSON.stringify({ events: calendar.events, availability: calendar.availability, queriedRange: calendar.queriedRange })}` : '';
  const images = attachments
    .filter((item) => /^image\/(jpeg|png|webp|heic|heif)$/.test(item.mimeType) && item.data.length <= 6_000_000)
    .slice(0, 3)
    .map((item) => ({ type: 'image' as const, image: item.data, mediaType: item.mimeType }));
  if (!images.length) return `${prompt || '添付画像について説明してください。'}${calendarContext}`;
  return [...images, { type: 'text' as const, text: `${prompt || '添付画像について説明してください。'}${calendarContext}` }];
}

async function renderResponse(apiKey: string, prompt: string, attachments: ChatAttachment[], history: ConversationHistoryItem[], calendar?: CalendarResult): Promise<GeminiResponse> {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;
  const result = await generateText({
    model: google(MODEL_NAME), system: SYSTEM,
    messages: [...historyMessages(history), { role: 'user', content: userContent(prompt, attachments, calendar) }],
    output: Output.object({ schema: responseSchema }), temperature: 0.5
  });
  return { text: result.output.message, emotion: result.output.emotion };
}

export async function handleFunctionCalling(
  apiKey: string, userPrompt: string, _legacyOauthToken: string | null,
  attachments: ChatAttachment[] = [], conversationHistory: ConversationHistoryItem[] = [],
  provider?: CalendarProvider, timezone = 'Asia/Tokyo'
): Promise<GeminiResponse> {
  if (!isCalendarIntent(userPrompt)) return renderResponse(apiKey, userPrompt, attachments, conversationHistory);

  try {
    const calendarProvider = provider ?? new GoogleServiceAccountCalendarProvider();
    const query = normalizeCalendarQuery(userPrompt, new Date(), timezone);
    let calendarResult: CalendarResult | undefined;
    const calendarTool = tool({
      description: 'サーバーで設定されたカレンダーから公開予定と空き状況を取得する',
      inputSchema: z.object({}),
      execute: async () => calendarProvider.query(query)
    });
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;
    const execution = await generateText({
      model: google(MODEL_NAME), prompt: userPrompt, tools: { getCalendar: calendarTool }, toolChoice: { type: 'tool', toolName: 'getCalendar' }, stopWhen: ({ steps }) => steps.length >= 1
    });
    calendarResult = execution.toolResults[0]?.output as CalendarResult | undefined;
    if (!calendarResult) calendarResult = await calendarProvider.query(query);
    const response = await renderResponse(apiKey, userPrompt, attachments, conversationHistory, calendarResult);
    return { ...response, calendar: { queriedRange: calendarResult.queriedRange, publicEventCount: calendarResult.events.length, availabilityProvided: Boolean(calendarResult.availability) } };
  } catch (error) {
    const code = error instanceof CalendarProviderError ? error.code : 'calendar_unavailable';
    return { text: '今はカレンダーを確認できんかったと。少し時間をおいて、もう一度試してね。', emotion: 'sad', action: { type: 'retry', reason: code } };
  }
}
