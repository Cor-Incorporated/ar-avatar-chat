/**
 * ボトムシートUI - モバイル最適化されたチャットインターフェース
 * AR表示領域を最大化しながら、直感的なチャット操作を提供
 */

import type {
  BottomSheetState,
  BottomSheetConfig,
  ChatAttachment,
  ChatMessage,
  MessageSendPayload,
} from '../types/chat.types.js';

export class BottomSheet {
  private container: HTMLElement | null = null;
  private messagesContainer: HTMLElement | null = null;
  private inputContainer: HTMLElement | null = null;
  private attachmentPreview: HTMLElement | null = null;
  private dragHandle: HTMLElement | null = null;
  private inputElement: HTMLInputElement | null = null;
  private fileInputElement: HTMLInputElement | null = null;
  private attachButton: HTMLButtonElement | null = null;
  private sendButton: HTMLButtonElement | null = null;

  private state: BottomSheetState = 'collapsed';
  private startY: number = 0;
  private currentY: number = 0;
  private messages: ChatMessage[] = [];
  private pendingAttachment: ChatAttachment | null = null;
  private keyboardOverlayActive: boolean = false;
  private lockedScrollY: number = 0;
  private stableViewportWidth: number = window.innerWidth;
  private stableViewportHeight: number = window.innerHeight;
  private blurReleaseTimer: number | null = null;
  private keyboardCorrectionFrameId: number | null = null;
  private lastAppliedOffsetX: number | null = null;
  private lastAppliedOffsetY: number | null = null;

  private config: BottomSheetConfig = {
    collapsedHeight: 120,
    peekHeight: 240,
    expandedHeight: 480,
    dragThreshold: 50,
    animationDuration: 300,
  };

  private onSendMessage: ((payload: MessageSendPayload) => void) | null = null;

  constructor() {
    this.createBottomSheet();
    this.attachEventListeners();
    this.syncViewportMetrics();
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
        <div class="attachment-preview" id="attachment-preview" aria-live="polite"></div>
        <div class="input-container" id="input-container">
          <input
            type="file"
            id="bottom-sheet-file"
            class="bottom-sheet-file"
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
            aria-label="画像を添付"
          />
          <button id="bottom-sheet-attach" class="bottom-sheet-attach" title="画像を添付" aria-label="画像を添付">+</button>
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
    this.attachmentPreview = document.getElementById('attachment-preview');
    this.inputContainer = document.getElementById('input-container');
    this.inputElement = document.getElementById('bottom-sheet-input') as HTMLInputElement;
    this.fileInputElement = document.getElementById('bottom-sheet-file') as HTMLInputElement;
    this.attachButton = document.getElementById('bottom-sheet-attach') as HTMLButtonElement;
    this.sendButton = document.getElementById('bottom-sheet-send') as HTMLButtonElement;

    // 初期状態を設定
    this.collapse();
  }

  /**
   * イベントリスナーを設定
   */
  private attachEventListeners(): void {
    if (!this.dragHandle || !this.inputElement || !this.fileInputElement || !this.attachButton || !this.sendButton) {
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

    // 画像添付
    this.attachButton.addEventListener('click', () => this.fileInputElement?.click());
    this.fileInputElement.addEventListener('change', this.handleFileSelection.bind(this));

    // Enterキーで送信
    this.inputElement.addEventListener('keypress', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    this.inputElement.addEventListener('touchstart', this.activateKeyboardOverlayFromPointer, { passive: true });
    this.inputElement.addEventListener('mousedown', this.activateKeyboardOverlayFromPointer);

    this.inputElement.addEventListener('focus', () => {
      this.activateKeyboardOverlay();
      if (this.state === 'collapsed' && this.messages.length > 0) {
        this.peek();
      }
      this.syncViewportMetrics();
    });

    this.inputElement.addEventListener('blur', () => {
      if (this.blurReleaseTimer) {
        window.clearTimeout(this.blurReleaseTimer);
      }
      this.blurReleaseTimer = window.setTimeout(() => {
        this.deactivateKeyboardOverlay();
        this.syncViewportMetrics();
      }, 180);
    });

    window.visualViewport?.addEventListener('resize', this.syncViewportMetrics);
    window.visualViewport?.addEventListener('scroll', this.syncViewportMetrics);
    window.addEventListener('resize', this.syncViewportMetrics);
  }

  /**
   * iOS Safariのキーボード表示時にAR画面をリサイズせず、入力欄だけを追従させる
   */
  private syncViewportMetrics = (): void => {
    if (!this.container) return;

    const viewport = window.visualViewport;
    const layoutHeight = document.documentElement.clientHeight || window.innerHeight;
    const keyboardOffset = viewport
      ? Math.max(0, layoutHeight - viewport.height - viewport.offsetTop)
      : 0;

    this.container.style.setProperty('--keyboard-offset', `${keyboardOffset}px`);
    document.documentElement.style.setProperty('--keyboard-offset', `${keyboardOffset}px`);

    if (this.inputContainer) {
      const inputHeight = this.inputContainer.getBoundingClientRect().height;
      this.container.style.setProperty('--chat-input-height', `${Math.ceil(inputHeight)}px`);
    }

    if (!this.keyboardOverlayActive && keyboardOffset === 0) {
      this.captureStableViewport();
    }
  };

  /**
   * キーボード表示前のAR表示サイズを保存する。
   * iOS/Chromeは入力フォーカス後にvisualViewportを縮めるため、その前の値をAR背景の固定基準にする。
   */
  private captureStableViewport(): void {
    const viewport = window.visualViewport;
    const layoutWidth = document.documentElement.clientWidth || window.innerWidth;
    const layoutHeight = document.documentElement.clientHeight || window.innerHeight;

    this.stableViewportWidth = Math.round(Math.max(layoutWidth, viewport?.width || 0));
    this.stableViewportHeight = Math.round(Math.max(layoutHeight, viewport?.height || 0));

    document.documentElement.style.setProperty('--ar-layout-width', `${this.stableViewportWidth}px`);
    document.documentElement.style.setProperty('--ar-layout-height', `${this.stableViewportHeight}px`);
  }

  private prepareKeyboardOverlay = (): void => {
    if (this.blurReleaseTimer) {
      window.clearTimeout(this.blurReleaseTimer);
      this.blurReleaseTimer = null;
    }

    this.lockedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    this.captureStableViewport();
  };

  private activateKeyboardOverlayFromPointer = (): void => {
    this.activateKeyboardOverlay();
    window.setTimeout(() => {
      if (document.activeElement !== this.inputElement) {
        this.deactivateKeyboardOverlay();
      }
    }, 500);
  };

  /**
   * 入力中はチャット欄だけを半透明オーバーレイとして持ち上げ、AR/video/canvasの基準画面は固定する。
   */
  private activateKeyboardOverlay(): void {
    if (this.keyboardOverlayActive) return;

    this.keyboardOverlayActive = true;
    this.prepareKeyboardOverlay();

    document.documentElement.classList.add('keyboard-overlay-active');
    document.body.classList.add('keyboard-overlay-active');
    document.body.style.setProperty('--locked-scroll-y', `${this.lockedScrollY}px`);

    window.dispatchEvent(new CustomEvent('ar-keyboard-overlay-change', { detail: { active: true } }));
    this.startKeyboardCorrectionLoop();
  }

  private deactivateKeyboardOverlay(): void {
    if (!this.keyboardOverlayActive) return;

    this.stopKeyboardCorrectionLoop();
    this.keyboardOverlayActive = false;
    document.documentElement.classList.remove('keyboard-overlay-active');
    document.body.classList.remove('keyboard-overlay-active');
    document.body.style.removeProperty('--locked-scroll-y');
    document.documentElement.style.setProperty('--keyboard-offset', '0px');
    this.container?.style.setProperty('--keyboard-offset', '0px');

    window.dispatchEvent(new CustomEvent('ar-keyboard-overlay-change', { detail: { active: false } }));
    window.scrollTo(0, this.lockedScrollY);
  }

  /**
   * iOS Safariの連続ビューポート変化に追従するため、キーボード表示中はrAFで補正を維持する。
   */
  private startKeyboardCorrectionLoop(): void {
    if (this.keyboardCorrectionFrameId !== null) return;

    const step = (): void => {
      if (!this.keyboardOverlayActive) {
        this.keyboardCorrectionFrameId = null;
        this.clearARViewportOffsetCompensation();
        return;
      }

      if ((window.scrollY || document.documentElement.scrollTop || 0) !== this.lockedScrollY) {
        window.scrollTo(0, this.lockedScrollY);
      }
      this.applyARViewportOffsetCompensation();
      this.keyboardCorrectionFrameId = window.requestAnimationFrame(step);
    };

    this.keyboardCorrectionFrameId = window.requestAnimationFrame(step);
  }

  private stopKeyboardCorrectionLoop(): void {
    if (this.keyboardCorrectionFrameId !== null) {
      window.cancelAnimationFrame(this.keyboardCorrectionFrameId);
      this.keyboardCorrectionFrameId = null;
    }
    this.clearARViewportOffsetCompensation();
  }

  private applyARViewportOffsetCompensation(): void {
    const viewport = window.visualViewport;
    const offsetTop = viewport?.offsetTop ?? 0;
    const offsetLeft = viewport?.offsetLeft ?? 0;
    const offsetX = -offsetLeft;
    const offsetY = -offsetTop;

    if (this.lastAppliedOffsetX === offsetX && this.lastAppliedOffsetY === offsetY) {
      return;
    }

    this.lastAppliedOffsetX = offsetX;
    this.lastAppliedOffsetY = offsetY;
    document.documentElement.style.setProperty('--ar-vv-offset-x', `${offsetX}px`);
    document.documentElement.style.setProperty('--ar-vv-offset-y', `${offsetY}px`);
  }

  private clearARViewportOffsetCompensation(): void {
    this.lastAppliedOffsetX = null;
    this.lastAppliedOffsetY = null;
    document.documentElement.style.setProperty('--ar-vv-offset-x', '0px');
    document.documentElement.style.setProperty('--ar-vv-offset-y', '0px');
  }

  /**
   * 状態ごとのCSSクラスを更新
   */
  private updateStateClass(): void {
    if (!this.container) return;

    this.container.classList.remove('state-collapsed', 'state-peek', 'state-expanded');
    this.container.classList.add(`state-${this.state}`);
  }

  /**
   * 添付画像を端末側で圧縮し、APIへ送れるBase64に変換する
   */
  private async handleFileSelection(): Promise<void> {
    const file = this.fileInputElement?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.showAttachmentError('画像ファイルを選択してください。');
      this.clearFileInput();
      return;
    }

    try {
      this.pendingAttachment = await this.optimizeImage(file);
      this.renderAttachmentPreview(file.name);
    } catch (error) {
      console.error('[BottomSheet] 画像の処理に失敗:', error);
      this.showAttachmentError('画像の読み込みに失敗しました。');
      this.pendingAttachment = null;
    } finally {
      this.clearFileInput();
      this.syncViewportMetrics();
    }
  }

  /**
   * モバイル回線とVercel payload制限を考慮して画像を縮小する
   */
  private async optimizeImage(file: File): Promise<ChatAttachment> {
    const dataUrl = await this.readFileAsDataURL(file);
    let optimizedDataUrl: string;

    try {
      optimizedDataUrl = await this.resizeImage(dataUrl, 1280, 0.82);
    } catch (error) {
      // HEICなどCanvasでデコードできない形式は、小さい場合だけ元データを送る
      if (file.size > 4_000_000) {
        throw error;
      }
      optimizedDataUrl = dataUrl;
    }

    const [header, data] = optimizedDataUrl.split(',');
    const mimeType = header.match(/^data:(.*);base64$/)?.[1] || 'image/jpeg';

    return {
      mimeType,
      data,
      name: file.name,
      size: Math.ceil((data.length * 3) / 4),
    };
  }

  private readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private resizeImage(dataUrl: string, maxSize: number, quality: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Canvas context is not available'));
          return;
        }

        context.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Image decode failed'));
      img.src = dataUrl;
    });
  }

  private renderAttachmentPreview(fileName: string): void {
    if (!this.attachmentPreview || !this.pendingAttachment) return;

    this.attachmentPreview.innerHTML = `
      <div class="attachment-pill">
        <span class="attachment-name">${this.escapeHtml(fileName)}</span>
        <button class="attachment-remove" type="button" aria-label="添付画像を削除">x</button>
      </div>
    `;
    this.attachmentPreview.style.display = 'block';
    this.attachmentPreview
      .querySelector('.attachment-remove')
      ?.addEventListener('click', () => this.clearAttachment());
  }

  private showAttachmentError(message: string): void {
    if (!this.attachmentPreview) return;

    this.attachmentPreview.innerHTML = `<div class="attachment-error">${this.escapeHtml(message)}</div>`;
    this.attachmentPreview.style.display = 'block';
    window.setTimeout(() => {
      if (!this.pendingAttachment && this.attachmentPreview) {
        this.attachmentPreview.style.display = 'none';
        this.attachmentPreview.innerHTML = '';
      }
    }, 3000);
  }

  private clearAttachment(): void {
    this.pendingAttachment = null;
    if (this.attachmentPreview) {
      this.attachmentPreview.style.display = 'none';
      this.attachmentPreview.innerHTML = '';
    }
    this.syncViewportMetrics();
  }

  private clearFileInput(): void {
    if (this.fileInputElement) {
      this.fileInputElement.value = '';
    }
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

    const currentHeight = Number(this.container.dataset.sheetHeight || this.config.collapsedHeight);
    const newHeight = Math.max(
      this.config.collapsedHeight,
      Math.min(this.config.expandedHeight, currentHeight + deltaY)
    );

    this.container.dataset.sheetHeight = `${newHeight}`;
    this.startY = this.currentY;
  }

  /**
   * タッチ終了 - スナップポイントに移動
   */
  private onDragEnd(): void {
    if (!this.container) return;

    const currentHeight = Number(this.container.dataset.sheetHeight || this.config.collapsedHeight);

    // スナップポイントを決定
    if (currentHeight < this.config.peekHeight - this.config.dragThreshold) {
      this.collapse();
    } else if (currentHeight < this.config.expandedHeight - this.config.dragThreshold) {
      this.peek();
    } else {
      this.expand();
    }
    delete this.container.dataset.sheetHeight;
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

      const currentHeight = Number(this.container.dataset.sheetHeight || this.config.collapsedHeight);
      const newHeight = Math.max(
        this.config.collapsedHeight,
        Math.min(this.config.expandedHeight, currentHeight + deltaY)
      );

      this.container.dataset.sheetHeight = `${newHeight}`;
      this.startY = this.currentY;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      this.onDragEnd();
      if (this.container) delete this.container.dataset.sheetHeight;
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
    this.updateStateClass();
    this.messagesContainer.style.display = 'none';
    this.syncViewportMetrics();
  }

  /**
   * プレビュー状態（直近2メッセージ表示）
   */
  public peek(): void {
    if (!this.container || !this.messagesContainer) return;

    this.state = 'peek';
    this.updateStateClass();
    this.messagesContainer.style.display = 'flex';
    this.displayRecentMessages(2);
    this.syncViewportMetrics();
  }

  /**
   * 展開状態（全メッセージ表示）
   */
  public expand(): void {
    if (!this.container || !this.messagesContainer) return;

    this.state = 'expanded';
    this.updateStateClass();
    this.messagesContainer.style.display = 'flex';
    this.displayRecentMessages(10);
    this.syncViewportMetrics();
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

    const attachments = this.pendingAttachment ? [this.pendingAttachment] : undefined;
    const text = this.inputElement.value.trim() || (attachments ? 'この画像について説明して' : '');
    if (!text) return;

    // ユーザーメッセージを追加
    this.addMessage('user', attachments ? `${text}（画像付き）` : text);
    this.inputElement.value = '';
    this.clearAttachment();

    // コールバックを実行
    if (this.onSendMessage) {
      this.onSendMessage({ message: text, attachments });
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

    if (this.state === 'collapsed') {
      this.peek();
    }
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
  public setSendCallback(callback: (payload: MessageSendPayload) => void): void {
    this.onSendMessage = callback;
  }

  /**
   * 現在の状態を取得
   */
  public getState(): BottomSheetState {
    return this.state;
  }
}
