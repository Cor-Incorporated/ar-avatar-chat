import { describe, expect, it, vi } from 'vitest';
import { createChatHandler } from './chat.js';

function responseHarness() {
  return {
    statusCode: 200, body: undefined, headers: {}, ended: false,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { this.ended = true; return this; },
  };
}

function dependencies(overrides = {}) {
  return {
    handleFunctionCalling: vi.fn().mockResolvedValue({ text: '通常応答', emotion: 'neutral' }),
    allowChatRequest: vi.fn().mockReturnValue(true),
    normalizeClientIp: vi.fn((value) => typeof value === 'string' ? value.split(',')[0] : null),
    getGeminiModel: vi.fn((env) => {
      if (env.GEMINI_MODEL !== 'gemini-3.1-flash-lite') throw new Error('model_not_configured');
      return env.GEMINI_MODEL;
    }),
    createRequestContext: vi.fn((now, timezone) => {
      if (timezone !== 'Asia/Tokyo') throw new Error('timezone_not_supported');
      return { now, timezone, locale: 'ja-JP' };
    }),
    ...overrides,
  };
}

function request(body = {}, method = 'POST') {
  return { method, body, headers: { 'x-vercel-forwarded-for': '203.0.113.10' }, socket: {} };
}

describe('/api/chat boundary harness', () => {
  it('passes the public request contract to the conversation service', async () => {
    const services = dependencies();
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const handler = createChatHandler({ loadServices: async () => services, env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.1-flash-lite', VERCEL_GIT_COMMIT_SHA: 'abcdef1234567' }, logger, now: () => 123, createRequestId: () => 'req-1' });
    const res = responseHarness();
    await handler(request({ message: ' こんにちは ', attachments: [], timezone: 'Asia/Tokyo' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ message: '通常応答', emotion: 'neutral' });
    expect(res.headers['X-Deployment-Commit']).toBe('abcdef1234567');
    const requestContext = { now: new Date(123), timezone: 'Asia/Tokyo', locale: 'ja-JP' };
    expect(services.handleFunctionCalling).toHaveBeenCalledWith('test-key', 'こんにちは', [], [], undefined, requestContext);
    expect(res.body.timestamp).toEqual(requestContext.now);
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('こんにちは');
  });

  it.each([
    ['GET', {}, 405],
    ['POST', {}, 400],
  ])('rejects invalid boundary input: %s', async (method, body, expected) => {
    const handler = createChatHandler({ loadServices: async () => dependencies(), env: { GEMINI_API_KEY: 'test-key' }, logger: { info() {}, warn() {}, error() {} } });
    const res = responseHarness();
    await handler(request(body, method), res);
    expect(res.statusCode).toBe(expected);
  });

  it('returns a stable rate-limit response without calling Gemini', async () => {
    const services = dependencies({ allowChatRequest: vi.fn().mockReturnValue(false) });
    const handler = createChatHandler({ loadServices: async () => services, env: { GEMINI_API_KEY: 'test-key' }, logger: { info() {}, warn() {}, error() {} } });
    const res = responseHarness();
    await handler(request({ message: 'こんにちは' }), res);
    expect(res.statusCode).toBe(429);
    expect(services.handleFunctionCalling).not.toHaveBeenCalled();
  });

  it('coarse-grains initialization and upstream errors', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const initHandler = createChatHandler({ loadServices: async () => { throw new Error('SECRET STACK'); }, env: {}, logger });
    const initRes = responseHarness();
    await initHandler(request({ message: 'こんにちは' }), initRes);
    expect(initRes.statusCode).toBe(500);
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('SECRET');

    const services = dependencies({ handleFunctionCalling: vi.fn().mockRejectedValue(new Error('SECRET UPSTREAM')) });
    const upstreamHandler = createChatHandler({ loadServices: async () => services, env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.1-flash-lite' }, logger });
    const upstreamRes = responseHarness();
    await upstreamHandler(request({ message: 'こんにちは' }), upstreamRes);
    expect(upstreamRes.statusCode).toBe(500);
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('SECRET');
  });

  it('does not trust phone-like request ids or timezone values in logs', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const handler = createChatHandler({
      loadServices: async () => dependencies(), env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.1-flash-lite' },
      logger, createRequestId: () => 'generated-safe-id',
    });
    const req = request({ message: 'hello', timezone: 'Asia/Tokyo' });
    req.headers['x-request-id'] = '09012345678';
    const res = responseHarness();
    await handler(req, res);
    const serialized = JSON.stringify(logger.info.mock.calls);
    expect(serialized).toContain('generated-safe-id');
    expect(serialized).not.toContain('09012345678');
    expect(res.headers['X-Request-ID']).toBe('generated-safe-id');
  });

  it('rejects unsupported timezones without logging their raw value', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const handler = createChatHandler({
      loadServices: async () => dependencies(),
      env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.1-flash-lite' }, logger,
    });
    const res = responseHarness();
    await handler(request({ message: 'hello', timezone: 'SECRET/TIMEZONE' }), res);
    expect(res.statusCode).toBe(400);
    const serialized = JSON.stringify(logger.warn.mock.calls);
    expect(serialized).toContain('unsupported');
    expect(serialized).not.toContain('SECRET');
  });

  it('requires the approved Gemini model before invoking the conversation service', async () => {
    const services = dependencies();
    const handler = createChatHandler({
      loadServices: async () => services, env: { GEMINI_API_KEY: 'test-key' },
      logger: { info() {}, warn() {}, error() {} },
    });
    const res = responseHarness();
    await handler(request({ message: 'hello' }), res);
    expect(res.statusCode).toBe(500);
    expect(services.handleFunctionCalling).not.toHaveBeenCalled();
  });
});
