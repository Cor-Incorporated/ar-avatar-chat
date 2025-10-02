/**
 * ボトムシートUI - モバイル最適化されたチャットインターフェース
 * AR表示領域を最大化しながら、直感的なチャット操作を提供
 */

import type { BottomSheetState, BottomSheetConfig, ChatMessage } from '../types/chat.types.js';

export class BottomSheet {
  private container: HTMLElement | null = null;
  private messagesContainer: HTMLElement | null = null;
  private inputContainer: HTMLElement | null = null;
  private dragHandle: HTMLElement | null = null;
  private inputElement: HTMLInputElement | null = null;
  private sendButton: HTMLButtonElement | null = null;

  private state: BottomSheetState = 'collapsed';
  private startY: number = 0;
  private currentY: number = 0;
  private messages: ChatMessage[] = [];

  private config: BottomSheetConfig = {
    collapsedHeight: 120,
    peekHeight: 240,
    expandedHeight: 480,
    dragThreshold: 50,
    animationDuration: 300,
  };

  private onSendMessage: ((message: string) => void) | null = null;

  constructor() {
    this.createBottomSheet();
    this.attachEventListeners();
  }

  /**
   * ボトムシートのDOM構造を作成
   */
  private createBottomSheet(): void {
    const html = `
      <div id="bottom-sheet" class="bottom-sheet">
        <div class="drag-handle" id="drag-handle"></div>
        <div class="messages-preview" id="messages-preview">
          <!-- メッセージがここに表示されます -->
        </div>
        <div class="input-container" id="input-container">
          <input
            type="text"
            id="bottom-sheet-input"
            class="bottom-sheet-input"
            placeholder="メッセージを入力..."
          />
          <button id="bottom-sheet-send" class="bottom-sheet-send">送信</button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    this.container = document.getElementById('bottom-sheet');
    this.dragHandle = document.getElementById('drag-handle');
    this.messagesContainer = document.getElementById('messages-preview');
    this.inputContainer = document.getElementById('input-container');
    this.inputElement = document.getElementById('bottom-sheet-input') as HTMLInputElement;
    this.sendButton = document.getElementById('bottom-sheet-send') as HTMLButtonElement;

    // 初期状態を設定
    this.collapse();
  }

  /**
   * イベントリスナーを設定
   */
  private attachEventListeners(): void {
    if (!this.dragHandle || !this.inputElement || !this.sendButton) {
      console.error('[BottomSheet] Required elements not found');
      return;
    }

    // ドラッグハンドルのイベント
    this.dragHandle.addEventListener('touchstart', this.onDragStart.bind(this), { passive: true });
    this.dragHandle.addEventListener('touchmove', this.onDragMove.bind(this), { passive: false });
    this.dragHandle.addEventListener('touchend', this.onDragEnd.bind(this));

    // マウスイベント（デスクトップ対応）
    this.dragHandle.addEventListener('mousedown', this.onMouseDown.bind(this));

    // 送信ボタン
    this.sendButton.addEventListener('click', this.handleSend.bind(this));

    // Enterキーで送信
    this.inputElement.addEventListener('keypress', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });
  }

  /**
   * タッチ開始
   */
  private onDragStart(e: TouchEvent): void {
    this.startY = e.touches[0].clientY;
  }

  /**
   * タッチ移動
   */
  private onDragMove(e: TouchEvent): void {
    e.preventDefault();

    if (!this.container) return;

    this.currentY = e.touches[0].clientY;
    const deltaY = this.startY - this.currentY;

    const currentHeight = this.container.offsetHeight;
    const newHeight = Math.max(
      this.config.collapsedHeight,
      Math.min(this.config.expandedHeight, currentHeight + deltaY)
    );

    this.container.style.height = `${newHeight}px`;
    this.startY = this.currentY;
  }

  /**
   * タッチ終了 - スナップポイントに移動
   */
  private onDragEnd(): void {
    if (!this.container) return;

    const currentHeight = this.container.offsetHeight;

    // スナップポイントを決定
    if (currentHeight < this.config.peekHeight - this.config.dragThreshold) {
      this.collapse();
    } else if (currentHeight < this.config.expandedHeight - this.config.dragThreshold) {
      this.peek();
    } else {
      this.expand();
    }
  }

  /**
   * マウスダウン（デスクトップ対応）
   */
  private onMouseDown(e: MouseEvent): void {
    e.preventDefault();
    this.startY = e.clientY;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!this.container) return;

      this.currentY = moveEvent.clientY;
      const deltaY = this.startY - this.currentY;

      const currentHeight = this.container.offsetHeight;
      const newHeight = Math.max(
        this.config.collapsedHeight,
        Math.min(this.config.expandedHeight, currentHeight + deltaY)
      );

      this.container.style.height = `${newHeight}px`;
      this.startY = this.currentY;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      this.onDragEnd();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * 折りたたみ状態
   */
  public collapse(): void {
    if (!this.container || !this.messagesContainer) return;

    this.state = 'collapsed';
    this.container.style.height = `${this.config.collapsedHeight}px`;
    this.messagesContainer.style.display = 'none';
  }

  /**
   * プレビュー状態（直近2メッセージ表示）
   */
  public peek(): void {
    if (!this.container || !this.messagesContainer) return;

    this.state = 'peek';
    this.container.style.height = `${this.config.peekHeight}px`;
    this.messagesContainer.style.display = 'flex';
    this.displayRecentMessages(2);
  }

  /**
   * 展開状態（全メッセージ表示）
   */
  public expand(): void {
    if (!this.container || !this.messagesContainer) return;

    this.state = 'expanded';
    this.container.style.height = `${this.config.expandedHeight}px`;
    this.messagesContainer.style.display = 'flex';
    this.displayRecentMessages(10);
  }

  /**
   * 直近のメッセージを表示
   */
  private displayRecentMessages(count: number): void {
    if (!this.messagesContainer) return;

    const recentMessages = this.messages.slice(-count);
    this.messagesContainer.innerHTML = recentMessages
      .map(msg => this.createMessageBubble(msg))
      .join('');

    // スクロールを最下部に
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  /**
   * メッセージバブルのHTMLを生成
   */
  private createMessageBubble(message: ChatMessage): string {
    const roleClass = message.role === 'user' ? 'user' : 'assistant';
    const avatar = message.role === 'user' ? '👤' : '🐧';

    return `
      <div class="message-bubble message-${roleClass}">
        <span class="message-avatar">${avatar}</span>
        <span class="message-text">${this.escapeHtml(message.content)}</span>
      </div>
    `;
  }

  /**
   * HTMLエスケープ
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * メッセージ送信処理
   */
  private handleSend(): void {
    if (!this.inputElement) return;

    const text = this.inputElement.value.trim();
    if (!text) return;

    // ユーザーメッセージを追加
    this.addMessage('user', text);
    this.inputElement.value = '';

    // コールバックを実行
    if (this.onSendMessage) {
      this.onSendMessage(text);
    }
  }

  /**
   * メッセージを追加
   */
  public addMessage(role: 'user' | 'assistant', content: string): void {
    const message: ChatMessage = {
      role,
      content,
      timestamp: new Date(),
    };

    this.messages.push(message);

    // 現在の状態に応じてメッセージを再表示
    if (this.state === 'peek') {
      this.displayRecentMessages(2);
    } else if (this.state === 'expanded') {
      this.displayRecentMessages(10);
    }

    // 自動的にpeek状態に移行（メッセージが追加されたら）
    if (this.state === 'collapsed') {
      this.peek();
    }
  }

  /**
   * タイピングインジケーターを表示
   */
  public showTyping(): void {
    if (!this.messagesContainer) return;

    const typingHTML = `
      <div class="message-bubble message-assistant typing-indicator" id="typing-indicator">
        <span class="message-avatar">🐧</span>
        <span class="message-text">
          <span class="typing-dot">.</span>
          <span class="typing-dot">.</span>
          <span class="typing-dot">.</span>
        </span>
      </div>
    `;

    this.messagesContainer.insertAdjacentHTML('beforeend', typingHTML);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  /**
   * タイピングインジケーターを非表示
   */
  public hideTyping(): void {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  /**
   * メッセージ送信コールバックを設定
   */
  public setSendCallback(callback: (message: string) => void): void {
    this.onSendMessage = callback;
  }

  /**
   * 現在の状態を取得
   */
  public getState(): BottomSheetState {
    return this.state;
  }
}
