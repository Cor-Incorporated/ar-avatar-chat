/**
 * ARを背景として維持する、ノベルゲーム型のチャットUI。
 *
 * 旧BottomSheetの公開APIは保ちつつ、ドラッグ、body固定、スクロール復元、
 * ARレイヤーへのviewport補正は行わない。visualViewportの変化はチャットUIだけに反映する。
 */

import type {
  BottomSheetState,
  ChatAttachment,
  ChatMessage,
  ConversationHistoryItem,
  MessageSendPayload,
} from '../types/chat.types.js';

export class BottomSheet {
  private container: HTMLElement | null = null;
  private messagesContainer: HTMLElement | null = null;
  private inputContainer: HTMLElement | null = null;
  private attachmentPreview: HTMLElement | null = null;
  private statusElement: HTMLElement | null = null;
  private inputElement: HTMLInputElement | null = null;
  private fileInputElement: HTMLInputElement | null = null;
  private attachButton: HTMLButtonElement | null = null;
  private cameraButton: HTMLButtonElement | null = null;
  private sendButton: HTMLButtonElement | null = null;
  private retryButton: HTMLButtonElement | null = null;

  private state: BottomSheetState = 'collapsed';
  private messages: ChatMessage[] = [];
  private pendingAttachment: ChatAttachment | null = null;
  private sending = false;
  private retryCallback: (() => void) | null = null;
  private onSendMessage: ((payload: MessageSendPayload) => void) | null = null;
  private readonly listenerController = new AbortController();
  private blurTimer: number | null = null;
  private liveRegionTimer: number | null = null;
  private attachmentErrorTimer: number | null = null;

  constructor() {
    this.createBottomSheet();
    this.attachEventListeners();
    this.syncViewportMetrics();
  }

  private createBottomSheet(): void {
    const html = `
      <section id="bottom-sheet" class="bottom-sheet state-collapsed" aria-label="キャラクターとの会話">
        <div class="messages-preview" id="messages-preview" role="log" aria-live="polite" aria-relevant="additions"></div>
        <div class="chat-controls">
          <div class="attachment-preview" id="attachment-preview" aria-live="polite"></div>
          <div class="chat-status" id="chat-status" role="status" aria-live="polite">
            <span class="chat-status-message"></span>
            <button class="chat-retry" id="chat-retry" type="button" hidden>再試行</button>
          </div>
          <form class="input-container" id="input-container">
            <input
              type="file"
              id="bottom-sheet-file"
              class="bottom-sheet-file"
              accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
              aria-label="ギャラリーから画像を選択"
            />
            <div class="attachment-actions" role="group" aria-label="画像添付">
              <button id="bottom-sheet-attach" class="bottom-sheet-attach" type="button" title="ギャラリーから画像を添付" aria-label="ギャラリーから画像を添付">🖼</button>
              <button id="bottom-sheet-camera" class="bottom-sheet-camera" type="button" title="カメラ映像をキャプチャ" aria-label="カメラ映像をキャプチャ">📷</button>
            </div>
            <label class="sr-only" for="bottom-sheet-input">メッセージ</label>
            <input
              type="text"
              id="bottom-sheet-input"
              class="bottom-sheet-input"
              placeholder="メッセージを入力..."
              autocomplete="off"
            />
            <button id="bottom-sheet-send" class="bottom-sheet-send" type="submit">送信</button>
          </form>
        </div>
      </section>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    this.container = document.getElementById('bottom-sheet');
    this.messagesContainer = document.getElementById('messages-preview');
    this.attachmentPreview = document.getElementById('attachment-preview');
    this.statusElement = document.getElementById('chat-status');
    this.inputContainer = document.getElementById('input-container');
    this.inputElement = document.getElementById('bottom-sheet-input') as HTMLInputElement;
    this.fileInputElement = document.getElementById('bottom-sheet-file') as HTMLInputElement;
    this.attachButton = document.getElementById('bottom-sheet-attach') as HTMLButtonElement;
    this.cameraButton = document.getElementById('bottom-sheet-camera') as HTMLButtonElement;
    this.sendButton = document.getElementById('bottom-sheet-send') as HTMLButtonElement;
    this.retryButton = document.getElementById('chat-retry') as HTMLButtonElement;
  }

  private attachEventListeners(): void {
    if (!this.inputContainer || !this.inputElement || !this.fileInputElement || !this.attachButton || !this.cameraButton || !this.sendButton || !this.retryButton) {
      console.error('[BottomSheet] Required elements not found');
      return;
    }

    const options = { signal: this.listenerController.signal };
    this.inputContainer.addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleSend();
    }, options);
    this.attachButton.addEventListener('click', () => this.fileInputElement?.click(), options);
    this.cameraButton.addEventListener('click', () => void this.handleCameraCapture(), options);
    this.fileInputElement.addEventListener('change', () => void this.handleFileSelection(), options);
    this.retryButton.addEventListener('click', () => {
      const retry = this.retryCallback;
      this.clearError();
      retry?.();
    }, options);
    this.inputElement.addEventListener('focus', () => {
      this.container?.classList.add('keyboard-visible');
      this.syncViewportMetrics();
    }, options);
    this.inputElement.addEventListener('blur', () => {
      if (this.blurTimer !== null) window.clearTimeout(this.blurTimer);
      this.blurTimer = window.setTimeout(() => {
        this.blurTimer = null;
        if (document.activeElement !== this.inputElement) {
          this.container?.classList.remove('keyboard-visible');
          this.syncViewportMetrics();
        }
      }, 100);
    }, options);

    window.visualViewport?.addEventListener('resize', this.syncViewportMetrics, options);
    window.visualViewport?.addEventListener('scroll', this.syncViewportMetrics, options);
    window.addEventListener('resize', this.syncViewportMetrics, options);
  }

  /** visual viewport下端までの距離をUIにだけ適用する。 */
  private syncViewportMetrics = (): void => {
    if (!this.container) return;
    const viewport = window.visualViewport;
    const layoutHeight = document.documentElement.clientHeight || window.innerHeight;
    const viewportBottom = viewport ? viewport.height + viewport.offsetTop : layoutHeight;
    const offset = Math.max(0, Math.round(layoutHeight - viewportBottom));
    this.container.style.setProperty('--viewport-bottom-offset', `${offset}px`);

    if (this.inputContainer) {
      const height = Math.ceil(this.inputContainer.getBoundingClientRect().height);
      this.container.style.setProperty('--chat-input-height', `${height}px`);
    }
  };

  private updateStateClass(): void {
    if (!this.container) return;
    this.container.classList.remove('state-collapsed', 'state-peek', 'state-expanded');
    this.container.classList.add(`state-${this.state}`);
  }

  private async handleCameraCapture(): Promise<void> {
    try {
      const file = this.captureArVideoFrame();
      this.pendingAttachment = await this.optimizeImage(file);
      this.renderAttachmentPreview(file.name);
    } catch (error) {
      console.error('[BottomSheet] カメラキャプチャに失敗:', error);
      this.showAttachmentError('カメラ映像の取得に失敗しました。');
      this.pendingAttachment = null;
    } finally {
      this.syncViewportMetrics();
    }
  }

  private captureArVideoFrame(): File {
    const video = document.querySelector('#arjs-video') as HTMLVideoElement | null;
    if (!video || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
      throw new Error('AR camera video is not ready');
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context is not available');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex < 0) throw new Error('Failed to encode camera frame');
    const binary = atob(dataUrl.slice(commaIndex + 1));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return new File([bytes], `ar-camera-${stamp}.jpg`, { type: 'image/jpeg' });
  }

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

  private async optimizeImage(file: File): Promise<ChatAttachment> {
    const dataUrl = await this.readFileAsDataURL(file);
    let optimizedDataUrl: string;
    try {
      optimizedDataUrl = await this.resizeImage(dataUrl, 1280, 0.82);
    } catch (error) {
      if (file.size > 4_000_000) throw error;
      optimizedDataUrl = dataUrl;
    }
    const [header, data] = optimizedDataUrl.split(',');
    const mimeType = header.match(/^data:(.*);base64$/)?.[1] || 'image/jpeg';
    return { mimeType, data, name: file.name, size: Math.ceil((data.length * 3) / 4) };
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
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) return reject(new Error('Canvas context is not available'));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      image.onerror = () => reject(new Error('Image decode failed'));
      image.src = dataUrl;
    });
  }

  private renderAttachmentPreview(fileName: string): void {
    if (!this.attachmentPreview || !this.pendingAttachment) return;
    this.attachmentPreview.innerHTML = `
      <div class="attachment-pill">
        <span class="attachment-name">${this.escapeHtml(fileName)}</span>
        <button class="attachment-remove" type="button" aria-label="添付画像を削除">×</button>
      </div>`;
    this.attachmentPreview.classList.add('is-visible');
    this.attachmentPreview.querySelector('.attachment-remove')?.addEventListener('click', () => this.clearAttachment());
  }

  private showAttachmentError(message: string): void {
    if (!this.attachmentPreview) return;
    this.attachmentPreview.innerHTML = `<div class="attachment-error">${this.escapeHtml(message)}</div>`;
    this.attachmentPreview.classList.add('is-visible');
    if (this.attachmentErrorTimer !== null) window.clearTimeout(this.attachmentErrorTimer);
    this.attachmentErrorTimer = window.setTimeout(() => {
      this.attachmentErrorTimer = null;
      if (!this.pendingAttachment && this.attachmentPreview) this.clearAttachment();
    }, 3000);
  }

  private clearAttachment(): void {
    if (this.attachmentErrorTimer !== null) {
      window.clearTimeout(this.attachmentErrorTimer);
      this.attachmentErrorTimer = null;
    }
    this.pendingAttachment = null;
    if (this.attachmentPreview) {
      this.attachmentPreview.classList.remove('is-visible');
      this.attachmentPreview.innerHTML = '';
    }
    this.syncViewportMetrics();
  }

  private clearFileInput(): void {
    if (this.fileInputElement) this.fileInputElement.value = '';
  }

  /** 会話を隠す。入力列は常に利用できる。 */
  public collapse(): void {
    this.state = 'collapsed';
    this.updateStateClass();
    this.renderMessages();
  }

  /** 最新のユーザー発言と応答を優先表示する。 */
  public peek(): void {
    this.state = 'peek';
    this.updateStateClass();
    this.renderMessages();
  }

  /** 履歴をスクロール可能な会話パネルとして表示する。 */
  public expand(): void {
    this.state = 'expanded';
    this.updateStateClass();
    this.renderMessages();
  }

  private renderMessages(): void {
    if (!this.messagesContainer) return;
    const count = this.state === 'expanded' ? 10 : 2;
    this.messagesContainer.setAttribute('aria-live', 'off');
    this.messagesContainer.innerHTML = this.messages.slice(-count).map((message) => this.createMessageBubble(message)).join('');
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    if (this.liveRegionTimer !== null) window.clearTimeout(this.liveRegionTimer);
    this.liveRegionTimer = window.setTimeout(() => {
      this.liveRegionTimer = null;
      this.messagesContainer?.setAttribute('aria-live', 'polite');
    }, 0);
  }

  private createMessageBubble(message: ChatMessage): string {
    const roleClass = message.role === 'user' ? 'user' : 'assistant';
    const avatar = message.role === 'user' ? '👤' : '🐧';
    const label = message.role === 'user' ? 'あなた' : 'AIアンバサダー';
    return `
      <article class="message-bubble message-${roleClass}" aria-label="${label}のメッセージ">
        <span class="message-avatar" aria-hidden="true">${avatar}</span>
        <p class="message-text">${this.escapeHtml(message.content)}</p>
      </article>`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private handleSend(): void {
    if (!this.inputElement || this.sending) return;
    const attachments = this.pendingAttachment ? [this.pendingAttachment] : undefined;
    const text = this.inputElement.value.trim() || (attachments ? 'この画像について説明して' : '');
    if (!text) return;

    const conversationHistory = this.getConversationHistory(10);
    this.addMessage('user', attachments ? `${text}（画像付き）` : text);
    this.inputElement.value = '';
    this.clearAttachment();
    this.clearError();
    this.onSendMessage?.({ message: text, attachments, conversationHistory });
  }

  private getConversationHistory(maxTurns: number): ConversationHistoryItem[] {
    return this.messages.slice(-(maxTurns * 2)).map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      content: message.content,
    }));
  }

  public addMessage(role: 'user' | 'assistant', content: string): void {
    this.messages.push({ role, content, timestamp: new Date() });
    const wasCollapsed = this.state === 'collapsed';
    if (wasCollapsed) this.state = 'peek';
    this.updateStateClass();
    if (!wasCollapsed && this.messagesContainer) {
      this.messagesContainer.insertAdjacentHTML(
        'beforeend',
        this.createMessageBubble(this.messages[this.messages.length - 1]),
      );
      const count = this.state === 'expanded' ? 10 : 2;
      while (this.messagesContainer.children.length > count) this.messagesContainer.firstElementChild?.remove();
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    } else {
      this.renderMessages();
    }
  }

  public showTyping(): void {
    if (!this.messagesContainer) return;
    this.setSending(true);
    if (this.state === 'collapsed') {
      this.state = 'peek';
      this.updateStateClass();
    }
    this.messagesContainer.insertAdjacentHTML('beforeend', `
      <div class="message-bubble message-assistant typing-indicator" id="typing-indicator" aria-label="AIアンバサダーが応答を作成中">
        <span class="message-avatar" aria-hidden="true">🐧</span>
        <span class="message-text"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span>
      </div>`);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  public hideTyping(): void {
    document.getElementById('typing-indicator')?.remove();
    this.setSending(false);
  }

  public setSending(sending: boolean): void {
    this.sending = sending;
    this.container?.classList.toggle('is-sending', sending);
    this.inputContainer?.setAttribute('aria-busy', String(sending));
    if (this.sendButton) {
      this.sendButton.disabled = sending;
      this.sendButton.textContent = sending ? '送信中' : '送信';
    }
    if (this.inputElement) {
      // disabledはiOSでフォーカスを失いキーボードを閉じるためreadonlyを使う。
      this.inputElement.readOnly = sending;
      this.inputElement.setAttribute('aria-disabled', String(sending));
    }
    if (this.attachButton) this.attachButton.disabled = sending;
    if (this.cameraButton) this.cameraButton.disabled = sending;
    if (this.fileInputElement) this.fileInputElement.disabled = sending;
    if (this.retryButton) this.retryButton.disabled = sending;
  }

  /** エラーを操作位置の隣に表示し、必要なら再試行を提供する。 */
  public showError(message: string, retry?: () => void): void {
    const messageElement = this.statusElement?.querySelector('.chat-status-message');
    if (messageElement) messageElement.textContent = message;
    this.retryCallback = retry ?? null;
    if (this.retryButton) this.retryButton.hidden = !retry;
    this.statusElement?.classList.add('is-visible', 'is-error');
  }

  public clearError(): void {
    const messageElement = this.statusElement?.querySelector('.chat-status-message');
    if (messageElement) messageElement.textContent = '';
    this.retryCallback = null;
    if (this.retryButton) this.retryButton.hidden = true;
    this.statusElement?.classList.remove('is-visible', 'is-error');
  }

  public setSendCallback(callback: (payload: MessageSendPayload) => void): void {
    this.onSendMessage = callback;
  }

  public getState(): BottomSheetState {
    return this.state;
  }

  /** SPAの再初期化やテスト時にグローバルlistenerとDOMを確実に解放する。 */
  public destroy(): void {
    this.listenerController.abort();
    if (this.blurTimer !== null) window.clearTimeout(this.blurTimer);
    if (this.liveRegionTimer !== null) window.clearTimeout(this.liveRegionTimer);
    if (this.attachmentErrorTimer !== null) window.clearTimeout(this.attachmentErrorTimer);
    this.retryCallback = null;
    this.onSendMessage = null;
    this.container?.remove();
    this.container = null;
    this.messagesContainer = null;
    this.inputContainer = null;
    this.attachmentPreview = null;
    this.statusElement = null;
    this.inputElement = null;
    this.fileInputElement = null;
    this.attachButton = null;
    this.cameraButton = null;
    this.sendButton = null;
    this.retryButton = null;
  }
}
