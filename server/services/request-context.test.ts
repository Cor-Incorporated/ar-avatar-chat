import { describe, expect, it } from 'vitest';
import {
  buildCurrentTimeInstruction,
  createRequestContext,
  getGeminiModel,
  resolveTemporalFact,
  temporalFactResponse,
} from './request-context.service.js';
import { handleFunctionCalling } from './gemini.service.js';

describe('request context and temporal facts', () => {
  const instant = new Date('2026-07-10T15:05:00.000Z');
  const context = createRequestContext(instant, 'Asia/Tokyo');

  it('uses one immutable instant at the JST date boundary', () => {
    expect(context.now).not.toBe(instant);
    expect(context.now.toISOString()).toBe('2026-07-10T15:05:00.000Z');
    expect(buildCurrentTimeInstruction(context)).toContain('2026年7月11日、土曜日、00:05');
  });

  it.each([
    ['今日は何日？', 'current_date', '今日は2026年7月11日、土曜日ばい！'],
    ['今日は何曜日？', 'current_date', '土曜日'],
    ['今年は何年？', 'current_year', '今年は2026年ばい！'],
    ['今何時？', 'current_time', '2026年7月11日 00:05'],
  ])('answers %s without model knowledge', (prompt, kind, expected) => {
    const fact = resolveTemporalFact(prompt, context);
    expect(fact?.kind).toBe(kind);
    expect(temporalFactResponse(fact!)).toMatchObject({ emotion: 'neutral' });
    expect(temporalFactResponse(fact!).text).toContain(expected);
  });

  it('calculates leap-day weekday from the same JST instant', () => {
    const leapContext = createRequestContext(new Date('2028-02-28T15:00:00.000Z'), 'Asia/Tokyo');
    const fact = resolveTemporalFact('今日は何曜日？', leapContext);
    expect(fact).toMatchObject({ year: 2028, month: 2, day: 29, weekday: '火曜日' });
    expect(buildCurrentTimeInstruction(leapContext)).toContain('2028年2月29日、火曜日');
  });

  it('does not intercept unrelated conversation', () => {
    expect(resolveTemporalFact('こんにちは', context)).toBeNull();
    expect(resolveTemporalFact('今日は何日ですか？ あと明日の予定も教えて', context)).toBeNull();
  });

  it('overrides stale conversation history without calling Gemini', async () => {
    const response = await handleFunctionCalling(
      'unused-for-deterministic-time',
      '今何年？',
      [],
      [{ role: 'model', content: '現在は2025年です' }],
      undefined,
      context,
    );
    expect(response.text).toBe('今年は2026年ばい！');
  });

  it('rejects unsupported timezones and invalid clocks', () => {
    expect(() => createRequestContext(instant, 'UTC')).toThrow('timezone_not_supported');
    expect(() => createRequestContext(new Date('invalid'))).toThrow('invalid_request_time');
  });

  it('requires an explicitly allowed Gemini model', () => {
    expect(getGeminiModel({ GEMINI_MODEL: 'gemini-3.1-flash-lite' } as NodeJS.ProcessEnv)).toBe('gemini-3.1-flash-lite');
    expect(() => getGeminiModel({} as NodeJS.ProcessEnv)).toThrow('GEMINI_MODEL is required');
    expect(() => getGeminiModel({ GEMINI_MODEL: 'gemini-unknown' } as NodeJS.ProcessEnv)).toThrow('GEMINI_MODEL is not allowed');
  });
});
