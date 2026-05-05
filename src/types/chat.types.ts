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
 * チャットAPIレスポンス
 */
export interface ChatAPIResponse {
  message: string;
  emotion: EmotionType;
  timestamp: string;
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
}

/**
 * メッセージ送信ペイロード
 */
export interface MessageSendPayload {
  message: string;
  attachments?: ChatAttachment[];
}

/**
 * ボトムシート状態
 */
export type BottomSheetState = 'collapsed' | 'peek' | 'expanded';

/**
 * ボトムシート設定
 */
export interface BottomSheetConfig {
  collapsedHeight: number;
  peekHeight: number;
  expandedHeight: number;
  dragThreshold: number;
  animationDuration: number;
}
