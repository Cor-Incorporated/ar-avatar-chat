/**
 * VRM関連の型定義
 * @pixiv/three-vrm の型を拡張
 */

import type { VRM, VRMExpressionPresetName } from '@pixiv/three-vrm';
import type { Scene, AnimationMixer } from 'three';

/**
 * VRMローダーイベント
 */
export interface VRMLoadedEvent {
  vrm: VRM;
  scene: Scene;
}

/**
 * 感情タイプ
 */
export type EmotionType =
  | 'neutral'
  | 'happy'
  | 'angry'
  | 'sad'
  | 'relaxed'
  | 'surprised'
  | 'thinking';

/**
 * 感情とVRM表情のマッピング
 */
export interface EmotionExpressionMapping {
  [key: string]: VRMExpressionPresetName;
}

/**
 * VRMアニメーション設定
 */
export interface VRMAnimationConfig {
  src: string;           // アニメーションファイルのパス
  autoplay?: boolean;    // 自動再生
  loop?: boolean;        // ループ再生
  crossFadeDuration?: number; // クロスフェード時間（秒）
}

/**
 * VRMアニメーションコントローラー状態
 */
export interface VRMAnimationState {
  currentAnimation: string | null;
  currentEmotion: EmotionType;
  mixer: AnimationMixer | null;
  isPlaying: boolean;
}

/**
 * 感情アニメーションマッピング
 */
export interface EmotionAnimationMapping {
  neutral: string;
  happy: string;
  angry: string;
  sad: string;
  relaxed: string;
  surprised: string;
  thinking: string;
}

/**
 * VRM表情プリセット
 * three-vrmの標準表情
 */
export type VRMExpression =
  | 'happy'
  | 'angry'
  | 'sad'
  | 'relaxed'
  | 'surprised'
  | 'neutral';
