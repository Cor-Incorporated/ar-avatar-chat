/**
 * Vercel Serverless Function: /api/chat
 * JavaScriptで実装（TypeScriptのビルド問題を回避）
 */

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // OPTIONSリクエスト（CORS preflight）
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // POSTのみ許可
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    console.log('[API] リクエスト受信:', req.method, req.url);
    console.log('[API] ボディ:', req.body);
    
    // 動的インポート（Vercel環境用）
    let handleFunctionCalling;
    try {
      console.log('[API] Geminiサービスをインポート中...');
      const module = await import('../server/dist/services/gemini.service.js');
      handleFunctionCalling = module.handleFunctionCalling;
      console.log('[API] インポート成功');
    } catch (importError) {
      console.error('[API] インポートエラー詳細:', importError.message, importError.stack);
      res.status(500).json({
        error: 'サーバー初期化エラー',
        message: `サーバーの準備中です: ${importError.message}`,
        emotion: 'sad'
      });
      return;
    }
    
    const { message, oauthToken } = req.body;

    if (!message) {
      res.status(400).json({ error: 'メッセージが必要です' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error('[API] GEMINI_API_KEYが設定されていません');
      res.status(500).json({
        error: 'サーバー設定エラー',
        message: 'API設定が不足しています。',
        emotion: 'sad'
      });
      return;
    }

    console.log('[API] ユーザーメッセージ:', message);

    const result = await handleFunctionCalling(
      process.env.GEMINI_API_KEY,
      message,
      oauthToken || null
    );

    console.log('[API] Gemini応答:', result);

    res.status(200).json({
      message: result.text,
      emotion: result.emotion,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('[API] エラー:', error);
    res.status(500).json({
      error: 'サーバーエラーが発生しました',
      message: 'すみません、エラーが発生しました。',
      emotion: 'sad'
    });
  }
}

