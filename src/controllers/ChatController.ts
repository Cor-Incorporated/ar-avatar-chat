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
  private avatarController: AvatarEmotionController | null;
  private destroyed = false;

  constructor(
    apiEndpoint: string = 'http://localhost:3000/api/chat',
    avatarController: AvatarEmotionController | null = null,
  ) {
    this.apiEndpoint = apiEndpoint;
    this.avatarController = avatarController;
    this.bottomSheet = new BottomSheet();
    this.bottomSheet.setSendCallback(this.sendMessage.bind(this));
    window.addEventListener('pagehide', this.handlePageHide);
  }

  private handlePageHide = (): void => {
    this.destroy();
  };

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
      if (data.action?.type === 'retry') {
        this.bottomSheet.showError('カレンダー情報を取得できませんでした。', () => void this.sendMessage(payload));
      } else {
        this.bottomSheet.clearError();
      }

      // 感情に応じたアニメーション再生
      if (data.emotion) this.playEmotion(data.emotion);

    } catch (error) {
      console.error('[Chat Controller] エラー:', error);
      this.bottomSheet.hideTyping();
      this.bottomSheet.showError('通信に失敗しました。接続を確認して再試行してください。', () => void this.sendMessage(payload));

      // エラー時はsad感情を表示
      this.playEmotion('sad');
    }
  }

  /**
   * ボトムシートのインスタンスを取得
   */
  public getBottomSheet(): BottomSheet {
    return this.bottomSheet;
  }

  private playEmotion(emotion: string): void {
    if (this.avatarController) {
      this.avatarController.playEmotion(emotion);
      return;
    }
    // origin/dev単体との後方互換。新AR runtimeではconstructor DIを使用する。
    const legacyPlayEmotion = (window as typeof window & { playEmotion?: (value: string) => void }).playEmotion;
    legacyPlayEmotion?.(emotion);
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener('pagehide', this.handlePageHide);
    this.bottomSheet.destroy();
  }
}
