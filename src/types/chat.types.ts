import { EmotionType } from './vrm.types.js';

/**
 * チャットメッセージの役割
 */
export type MessageRole = 'user' | 'assistant';

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
 * Gemini contents の role は user/model
 */
export interface ConversationHistoryItem {
  role: 'user' | 'model';
  content: string;
}

/**
 * チャットAPIレスポンス
 */
export interface ChatAPIResponse {
  message: string;
  emotion: EmotionType;
  timestamp: string;
  action?: { type: 'retry'; reason: string };
  calendar?: {
    queriedRange: { start: string; end: string; timezone: string };
    publicEventCount: number;
    availabilityProvided: boolean;
  };
}

/**
 * チャットUIイベント
 */
export interface ChatUIEvent {
  type: 'message' | 'emotion' | 'animation';
  data: unknown;
}

/**
 * メッセージ送信イベント
 */
export interface MessageSendEvent {
  message: string;
  oauthToken?: string;
  attachments?: ChatAttachment[];
  conversationHistory?: ConversationHistoryItem[];
}

/**
 * メッセージ送信ペイロード
 */
export interface MessageSendPayload {
  message: string;
  attachments?: ChatAttachment[];
  conversationHistory?: ConversationHistoryItem[];
}

/**
 * ボトムシート状態
 */
export type BottomSheetState = 'collapsed' | 'peek' | 'expanded';
