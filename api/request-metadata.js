const SAFE_ERROR_CODES = new Set([
  'invalid_request', 'rate_limited', 'server_not_configured',
  'service_initialization_failed', 'upstream_failed',
]);

export function createRequestMetadata({
  requestId,
  route = 'unclassified',
  model = 'default',
  timezone = 'Asia/Tokyo',
  message,
  attachments,
  conversationHistory,
  startedAt,
  now = Date.now(),
  status,
  errorCode,
  knowledge,
  commitSha = process.env.VERCEL_GIT_COMMIT_SHA || 'local',
}) {
  return {
    requestId,
    route,
    model,
    timezone: timezone === 'Asia/Tokyo' ? timezone : 'unsupported',
    messageLength: typeof message === 'string' ? message.length : 0,
    attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
    historyTurns: Array.isArray(conversationHistory) ? conversationHistory.length : 0,
    latencyMs: typeof startedAt === 'number' ? Math.max(0, now - startedAt) : undefined,
    status,
    errorCode: SAFE_ERROR_CODES.has(errorCode) ? errorCode : undefined,
    knowledgeSourceIds: Array.isArray(knowledge?.sourceIds)
      ? knowledge.sourceIds.filter((value) => typeof value === 'string' && /^[a-z0-9._-]{1,64}$/i.test(value)).slice(0, 20)
      : [],
    knowledgeReviewedAt: Array.isArray(knowledge?.reviewedAt)
      ? knowledge.reviewedAt.filter((value) => typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(value)).slice(0, 20)
      : [],
    commitSha: commitSha.slice(0, 40),
  };
}
