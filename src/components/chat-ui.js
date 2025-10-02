class ChatUI {
  constructor() {
    this.messagesContainer = null;
    this.inputElement = null;
    this.sendButton = null;
    this.onSendMessage = null;
  }

  init() {
    this.createChatContainer();
    this.attachEventListeners();
  }

  createChatContainer() {
    const chatHTML = `
      <div id="chat-container" class="chat-container">
        <div id="chat-header" class="chat-header">
          <h3>Cor.Inc アシスタント</h3>
          <button id="chat-toggle" class="chat-toggle">−</button>
        </div>
        <div id="chat-messages" class="chat-messages"></div>
        <div id="chat-input-container" class="chat-input-container">
          <input
            type="text"
            id="chat-input"
            class="chat-input"
            placeholder="メッセージを入力..."
          >
          <button id="chat-send" class="chat-send">送信</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', chatHTML);
    this.messagesContainer = document.getElementById('chat-messages');
    this.inputElement = document.getElementById('chat-input');
    this.sendButton = document.getElementById('chat-send');
  }

  attachEventListeners() {
    this.sendButton.addEventListener('click', () => this.handleSend());
    this.inputElement.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    const toggleButton = document.getElementById('chat-toggle');
    const messagesContainer = this.messagesContainer;
    const inputContainer = document.getElementById('chat-input-container');

    toggleButton.addEventListener('click', () => {
      const isVisible = messagesContainer.style.display !== 'none';
      messagesContainer.style.display = isVisible ? 'none' : 'flex';
      inputContainer.style.display = isVisible ? 'none' : 'flex';
      toggleButton.textContent = isVisible ? '+' : '−';
    });
  }

  handleSend() {
    const text = this.inputElement.value.trim();
    if (!text) return;

    this.addMessage('user', text);
    this.inputElement.value = '';

    if (this.onSendMessage) {
      this.onSendMessage(text);
    }
  }

  addMessage(role, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message chat-message-${role}`;

    const avatarSpan = document.createElement('span');
    avatarSpan.className = 'chat-avatar';
    avatarSpan.textContent = role === 'user' ? '👤' : '🐧';

    const textSpan = document.createElement('span');
    textSpan.className = 'chat-text';
    textSpan.textContent = text;

    messageDiv.appendChild(avatarSpan);
    messageDiv.appendChild(textSpan);
    this.messagesContainer.appendChild(messageDiv);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  showTyping() {
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typing-indicator';
    typingDiv.className = 'chat-message chat-message-assistant';
    typingDiv.innerHTML = `
      <span class="chat-avatar">🐧</span>
      <span class="chat-text typing-dots">
        <span>.</span><span>.</span><span>.</span>
      </span>
    `;
    this.messagesContainer.appendChild(typingDiv);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  hideTyping() {
    const typingDiv = document.getElementById('typing-indicator');
    if (typingDiv) typingDiv.remove();
  }
}

window.ChatUI = ChatUI;
