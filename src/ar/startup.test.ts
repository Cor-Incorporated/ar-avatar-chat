import { describe, expect, it, vi } from 'vitest';
import { handleRuntimeStartFailure } from './startup.js';

describe('AR startup failure handling', () => {
  it('disposes the runtime and exposes a generic UI error for tracking initialization failures', () => {
    const runtime = { dispose: vi.fn() };
    const status = { textContent: '⏳ アバター読み込み中...' };
    const log = vi.fn();
    const error = new Error('ArMarkerControls initialization failed');

    handleRuntimeStartFailure(error, runtime, status, log);

    expect(log).toHaveBeenCalledWith('[AR] initialization failed', error);
    expect(runtime.dispose).toHaveBeenCalledOnce();
    expect(status.textContent).toBe('❌ ARの初期化に失敗しました');
  });

  it('keeps the permission-specific guidance for camera denials', () => {
    const runtime = { dispose: vi.fn() };
    const status = { textContent: '' };

    handleRuntimeStartFailure(
      new DOMException('localized', 'NotAllowedError'),
      runtime,
      status,
      vi.fn(),
    );

    expect(runtime.dispose).toHaveBeenCalledOnce();
    expect(status.textContent).toBe('📷 カメラへのアクセスを許可してください');
  });
});
