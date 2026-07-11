/**
 * チャットコントローラー - ボトムシートUIとAPI通信を管理
 */

import { BottomSheet } from '../components/BottomSheet.js';
import type { ChatAPIResponse, MessageSendPayload } from '../types/chat.types.js';

interface AvatarEmotionController {
  playEmotion(emotion: string): void;
}

export class ChatController {
  private bottomSheet: BottomSheet;
  private apiEndpoint: string;
  private avatarController: AvatarEmotionController | null = null;

  constructor(
    apiEndpoint: string = 'http://localhost:3000/api/chat',
    avatarController: AvatarEmotionController | null = null,
  ) {
    this.apiEndpoint = apiEndpoint;
    this.avatarController = avatarController;
    this.bottomSheet = new BottomSheet();
    this.bottomSheet.setSendCallback(this.sendMessage.bind(this));
  }

  /**
   * メッセージを送信してAPIから応答を取得
   */
  private async sendMessage(payload: MessageSendPayload): Promise<void> {
    try {
      // タイピングインジケーター表示
      this.bottomSheet.showTyping();

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: payload.message,
          attachments: payload.attachments,
          conversationHistory: payload.conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ChatAPIResponse = await response.json();

      // タイピングインジケーター非表示
      this.bottomSheet.hideTyping();

      // アシスタントのメッセージを追加
      this.bottomSheet.addMessage('assistant', data.message);

      // 感情に応じたアニメーション再生
      if (data.emotion) this.avatarController?.playEmotion(data.emotion);

    } catch (error) {
      console.error('[Chat Controller] エラー:', error);
      this.bottomSheet.hideTyping();
      this.bottomSheet.addMessage('assistant', 'すみません、エラーが発生しました。');

      // エラー時はsad感情を表示
      this.avatarController?.playEmotion('sad');
    }
  }

  /**
   * ボトムシートのインスタンスを取得
   */
  public getBottomSheet(): BottomSheet {
    return this.bottomSheet;
  }
}
