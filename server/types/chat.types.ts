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
  attachments?: ChatAttachment[];
}

/**
 * 画像添付
 */
export interface ChatAttachment {
  mimeType: string;
  data: string;
  name?: string;
  size?: number;
}


/**
 * API送受信用の会話履歴ターン（直近10往復）
 */
export interface ConversationHistoryItem {
  role: 'user' | 'model';
  content: string;
}

/**
 * チャットリクエスト
 */
export interface ChatRequest {
  message?: string;
  timezone?: string;
  conversationHistory?: ConversationHistoryItem[];
  attachments?: ChatAttachment[];
}

/**
 * チャットレスポンス
 */
export interface ChatResponse {
  message: string;
  emotion: EmotionType;
  timestamp: Date;
  action?: { type: 'retry'; reason: 'calendar_unavailable'; retryable: boolean };
  calendar?: { queriedRange: { start: string; end: string; timezone: string }; publicEventCount: number; availabilityProvided: boolean };
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
  action?: { type: 'retry'; reason: 'calendar_unavailable'; retryable: boolean };
  calendar?: { queriedRange: { start: string; end: string; timezone: string }; publicEventCount: number; availabilityProvided: boolean };
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
}
