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
