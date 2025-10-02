import { EmotionType } from './emotion.types.js';

/**
 * チャットメッセージの役割
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * チャットメッセージ
 */
export interface ChatMessage {
  role: MessageRole;
  content: string;
  timestamp: Date;
  emotion?: EmotionType;
}

/**
 * チャットリクエスト
 */
export interface ChatRequest {
  message: string;
  oauthToken?: string;
  conversationHistory?: ChatMessage[];
}

/**
 * チャットレスポンス
 */
export interface ChatResponse {
  message: string;
  emotion: EmotionType;
  timestamp: Date;
  functionCalled?: {
    name: string;
    result: unknown;
  };
}

/**
 * Google Calendar イベント
 */
export interface CalendarEvent {
  summary: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  description?: string;
  location?: string;
}

/**
 * カレンダー検索リクエスト
 */
export interface CalendarSearchRequest {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}

/**
 * カレンダー検索レスポンス
 */
export interface CalendarSearchResponse {
  events: CalendarEvent[];
  nextSyncToken?: string;
}

/**
 * Gemini API レスポンス
 */
export interface GeminiResponse {
  text: string;
  emotion: EmotionType;
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
}
