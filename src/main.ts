import { ARRuntime } from './ar/ARRuntime.js';
import { ChatController } from './controllers/ChatController.js';

const canvas = document.querySelector<HTMLCanvasElement>('#ar-canvas');
const status = document.querySelector<HTMLElement>('#status');
const info = document.querySelector<HTMLElement>('#info');
if (!canvas || !status || !info) throw new Error('Required AR shell elements were not found');

const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000/api/chat' : '/api/chat';
new ChatController(apiUrl);

const runtime = new ARRuntime(canvas);
runtime.addEventListener('markerfound', () => {
  status.textContent = '✅ マーカー検出！';
  info.classList.add('hidden');
});
runtime.addEventListener('markerlost', () => {
  status.textContent = '⏳ マーカーが見えません';
  info.classList.remove('hidden');
});
runtime.avatar.addEventListener('ready', () => {
  status.textContent = '✨ 準備完了！';
});

// Typed application API. ChatController migration can consume this without globals.
window.dispatchEvent(new CustomEvent('avatar-controller-ready', { detail: runtime.avatar }));

runtime.start().catch((error: unknown) => {
  console.error('[AR] initialization failed', error);
  runtime.dispose();
  status.textContent = error instanceof Error && /permission|denied|NotAllowed/i.test(error.message)
    ? '📷 カメラへのアクセスを許可してください'
    : '❌ ARの初期化に失敗しました';
});

window.addEventListener('pagehide', () => runtime.dispose(), { once: true });
