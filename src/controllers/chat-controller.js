class ChatController {
  constructor(chatUI) {
    this.chatUI = chatUI;
    this.apiEndpoint = 'http://localhost:3000/api/chat';
  }

  async sendMessage(text) {
    try {
      this.chatUI.showTyping();

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      this.chatUI.hideTyping();
      this.chatUI.addMessage('assistant', data.message);

      if (data.emotion && window.playEmotion) {
        window.playEmotion(data.emotion);
      }

    } catch (error) {
      console.error('[Chat Controller] エラー:', error);
      this.chatUI.hideTyping();
      this.chatUI.addMessage('assistant', 'すみません、エラーが発生しました。');
    }
  }
}

window.ChatController = ChatController;
