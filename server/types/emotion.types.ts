/**
 * VRMアバターの感情タイプ
 * 7種類の感情を定義
 */
export type EmotionType =
  | 'neutral'    // 中立
  | 'happy'      // 喜び
  | 'angry'      // 怒り
  | 'sad'        // 悲しみ
  | 'relaxed'    // リラックス
  | 'surprised'  // 驚き
  | 'thinking';  // 考え中

/**
 * 感情とアニメーションファイルのマッピング
 */
export interface EmotionMapping {
  neutral: string;
  happy: string;
  angry: string;
  sad: string;
  relaxed: string;
  surprised: string;
  thinking: string;
}

/**
 * 感情検出結果
 */
export interface EmotionDetectionResult {
  emotion: EmotionType;
  confidence: number; // 0.0 ~ 1.0
  reason?: string;    // 検出理由（デバッグ用）
}

/**
 * 感情分析リクエスト
 */
export interface EmotionAnalysisRequest {
  message: string;           // 分析対象のメッセージ
  context?: string;          // 会話のコンテキスト
  previousEmotion?: EmotionType; // 前回の感情
}
