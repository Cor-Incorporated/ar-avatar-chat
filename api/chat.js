/** Vercel Serverless Function: /api/chat */
import { randomUUID } from 'node:crypto';
import { createRequestMetadata } from '../server/lib/request-metadata.js';

async function loadDefaultServices() {
  const gemini = await import('../server/dist/services/gemini.service.js');
  const rateLimit = await import('../server/dist/services/rate-limit.service.js');
  return {
    handleFunctionCalling: gemini.handleFunctionCalling,
    allowChatRequest: rateLimit.allowChatRequest,
    normalizeClientIp: rateLimit.normalizeClientIp,
    ...await import('../server/dist/services/request-context.service.js'),
  };
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function exposeDeploymentCommit(res, commitSha) {
  if (typeof commitSha === 'string' && /^[a-f0-9]{7,40}$/i.test(commitSha)) {
    res.setHeader('X-Deployment-Commit', commitSha);
  }
}

function serverRequestId(factory) {
  const candidate = factory();
  return typeof candidate === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(candidate)
    ? candidate
    : randomUUID();
}

export function createChatHandler({
  loadServices = loadDefaultServices,
  env = process.env,
  logger = console,
  now = () => Date.now(),
  createRequestId = randomUUID,
} = {}) {
  return async function handler(req, res) {
    setCors(res);
    exposeDeploymentCommit(res, env.VERCEL_GIT_COMMIT_SHA);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const startedAt = now();
    const requestInstant = new Date(startedAt);
    // An inbound id can contain phone numbers or other PII. Correlation ids are
    // always server-generated and returned to the caller for support use.
    const requestId = serverRequestId(createRequestId);
    res.setHeader('X-Request-ID', requestId);
    const body = req.body || {};
    const baseMetadata = {
      requestId,
      commitSha: env.VERCEL_GIT_COMMIT_SHA,
      message: body.message,
      attachments: body.attachments,
      conversationHistory: body.conversationHistory,
      timezone: body.timezone || 'Asia/Tokyo',
      model: env.GEMINI_MODEL || 'missing',
      startedAt,
    };

    let services;
    try {
      services = await loadServices();
    } catch {
      logger.error('[API]', createRequestMetadata({ ...baseMetadata, now: now(), status: 500, errorCode: 'service_initialization_failed' }));
      return res.status(500).json({
        error: 'サーバー初期化エラー',
        message: 'サーバーの準備中です。少し時間をおいて再試行してください。',
        emotion: 'sad',
      });
    }

    try {
      const clientKey = services.normalizeClientIp(req.headers?.['x-vercel-forwarded-for'])
        || services.normalizeClientIp(req.headers?.['x-forwarded-for'])
        || services.normalizeClientIp(req.socket?.remoteAddress)
        || 'unknown';
      if (!services.allowChatRequest(clientKey)) {
        logger.warn('[API]', createRequestMetadata({ ...baseMetadata, now: now(), status: 429, errorCode: 'rate_limited' }));
        return res.status(429).json({ error: 'リクエストが多すぎます', message: '少し時間をおいて試してね。', emotion: 'sad' });
      }

      const normalizedMessage = typeof body.message === 'string' ? body.message.trim() : '';
      const hasAttachments = Array.isArray(body.attachments) && body.attachments.length > 0;
      if (!normalizedMessage && !hasAttachments) {
        logger.warn('[API]', createRequestMetadata({ ...baseMetadata, now: now(), status: 400, errorCode: 'invalid_request' }));
        return res.status(400).json({ error: 'メッセージまたは画像が必要です' });
      }
      if (!env.GEMINI_API_KEY) {
        logger.error('[API]', createRequestMetadata({ ...baseMetadata, now: now(), status: 500, errorCode: 'server_not_configured' }));
        return res.status(500).json({ error: 'サーバー設定エラー', message: 'API設定が不足しています。', emotion: 'sad' });
      }

      try {
        baseMetadata.model = services.getGeminiModel(env);
      } catch {
        logger.error('[API]', createRequestMetadata({ ...baseMetadata, now: now(), status: 500, errorCode: 'server_not_configured' }));
        return res.status(500).json({ error: 'サーバー設定エラー', message: 'API設定が不足しています。', emotion: 'sad' });
      }

      let requestContext;
      try {
        requestContext = services.createRequestContext(requestInstant, body.timezone || 'Asia/Tokyo');
      } catch {
        logger.warn('[API]', createRequestMetadata({ ...baseMetadata, now: now(), status: 400, errorCode: 'invalid_request' }));
        return res.status(400).json({ error: '未対応のタイムゾーンです', message: '日本時間で試してね。', emotion: 'sad' });
      }

      const result = await services.handleFunctionCalling(
        env.GEMINI_API_KEY,
        normalizedMessage,
        body.attachments || [],
        body.conversationHistory || [],
        undefined,
        requestContext,
      );
      baseMetadata.route = result.route;
      baseMetadata.model = result.model || baseMetadata.model;
      baseMetadata.knowledge = result.knowledge;
      logger.info('[API]', createRequestMetadata({ ...baseMetadata, now: now(), status: 200 }));
      return res.status(200).json({
        message: result.text,
        emotion: result.emotion,
        timestamp: requestContext.now,
        action: result.action,
        calendar: result.calendar,
      });
    } catch {
      logger.error('[API]', createRequestMetadata({ ...baseMetadata, now: now(), status: 500, errorCode: 'upstream_failed' }));
      return res.status(500).json({ error: 'サーバーエラーが発生しました', message: 'すみません、エラーが発生しました。', emotion: 'sad' });
    }
  };
}

export default createChatHandler();
