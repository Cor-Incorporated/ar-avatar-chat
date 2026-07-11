import { describe, expect, it } from 'vitest';
import { createRequestMetadata } from './request-metadata.js';

describe('request log metadata', () => {
  it('contains operational counts without user or calendar content', () => {
    const metadata = createRequestMetadata({
      requestId: 'req-1', route: 'calendar', model: 'gemini-test',
      message: 'SECRET MESSAGE', attachments: [{ data: 'SECRET IMAGE' }],
      conversationHistory: [{ content: 'SECRET HISTORY' }],
      startedAt: 100, now: 145, status: 200, errorCode: 'internal-stack',
      commitSha: 'a'.repeat(64),
      knowledge: { sourceIds: ['readme', 'SECRET SOURCE'], reviewedAt: ['2026-07-11', 'SECRET DATE'] },
    });
    expect(metadata).toMatchObject({ messageLength: 14, attachmentCount: 1, historyTurns: 1, latencyMs: 45, status: 200 });
    expect(metadata.commitSha).toHaveLength(40);
    expect(JSON.stringify(metadata)).not.toContain('SECRET');
    expect(metadata.errorCode).toBeUndefined();
    expect(metadata.knowledgeSourceIds).toEqual(['readme']);
    expect(metadata.knowledgeReviewedAt).toEqual(['2026-07-11']);
  });
});
