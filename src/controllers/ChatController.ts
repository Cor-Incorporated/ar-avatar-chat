/**
 * チャットコントローラー - ボトムシートUIとAPI通信を管理
 */

import { BottomSheet } from '../components/BottomSheet.js';
import type { ChatAPIResponse } from '../types/chat.types.js';

export class ChatController {
  private bottomSheet: BottomSheet;
  private apiEndpoint: string;

  constructor(apiEndpoint: string = 'http://localhost:3000/api/chat') {
    this.apiEndpoint = apiEndpoint;
    this.bottomSheet = new BottomSheet();
    this.bottomSheet.setSendCallback(this.sendMessage.bind(this));
  }

  /**
   * メッセージを送信してAPIから応答を取得
   */
  private async sendMessage(text: string): Promise<void> {
    try {
      // タイピングインジケーター表示
      this.bottomSheet.showTyping();

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
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
      if (data.emotion && (window as any).playEmotion) {
        (window as any).playEmotion(data.emotion);
      }

    } catch (error) {
      console.error('[Chat Controller] エラー:', error);
      this.bottomSheet.hideTyping();
      this.bottomSheet.addMessage('assistant', 'すみません、エラーが発生しました。');

      // エラー時はsad感情を表示
      if ((window as any).playEmotion) {
        (window as any).playEmotion('sad');
      }
    }
  }

  /**
   * ボトムシートのインスタンスを取得
   */
  public getBottomSheet(): BottomSheet {
    return this.bottomSheet;
  }
}

// グローバルに公開（既存コードとの互換性のため）
(window as any).ChatController = ChatController;
