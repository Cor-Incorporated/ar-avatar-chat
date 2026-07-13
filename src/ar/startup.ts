import { isCameraPermissionError } from './runtimeMath.js';

export interface DisposableRuntime {
  dispose(): void;
}

export function handleRuntimeStartFailure(
  error: unknown,
  runtime: DisposableRuntime,
  status: Pick<HTMLElement, 'textContent'>,
  log: (message: string, error: unknown) => void = console.error,
): void {
  log('[AR] initialization failed', error);
  runtime.dispose();
  status.textContent = isCameraPermissionError(error)
    ? '📷 カメラへのアクセスを許可してください'
    : '❌ ARの初期化に失敗しました';
}
