import { describe, expect, it } from 'vitest';
import { isCalendarIntent, normalizeCalendarQuery } from './calendar-intent.service.js';
import { extractPublicDescription, loadCalendarEnvironment, sanitizePublicEvent } from './google-calendar.service.js';
import { CalendarProviderError } from '../types/calendar.types.js';
import { allowChatRequest } from './rate-limit.service.js';

describe('calendar intent', () => {
  it.each(['こんにちは', 'おはようございます！', '会社を紹介して'])('does not route ordinary chat: %s', (message) => expect(isCalendarIntent(message)).toBe(false));
  it.each(['明日の公開予定を教えて', '今週の空き時間は？', '会議のスケジュール'])('routes explicit calendar requests: %s', (message) => expect(isCalendarIntent(message)).toBe(true));
  it('normalizes tomorrow in JST', () => {
    const query = normalizeCalendarQuery('明日の予定', new Date('2026-07-10T16:00:00Z'));
    expect(query.timeMin).toBe('2026-07-11T15:00:00.000Z');
    expect(query.timeMax).toBe('2026-07-12T15:00:00.000Z');
  });
});

describe('public boundary', () => {
  it('only exposes prefixed event fields and public description suffix', () => {
    const event = sanitizePublicEvent({ summary: '[公開] 相談会', description: '内部情報\n[公開説明]\nどなたでも参加できます', location: 'SECRET', attendees: [{ email: 'secret@example.com' }], start: { dateTime: '2026-07-12T10:00:00+09:00' }, end: { dateTime: '2026-07-12T11:00:00+09:00' } }, '[公開]');
    expect(event).toEqual({ title: '相談会', start: '2026-07-12T10:00:00+09:00', end: '2026-07-12T11:00:00+09:00', publicDescription: 'どなたでも参加できます' });
    expect(JSON.stringify(event)).not.toContain('SECRET');
    expect(JSON.stringify(event)).not.toContain('secret@example.com');
  });
  it('hides unprefixed events and descriptions without marker', () => {
    expect(sanitizePublicEvent({ summary: '役員会' }, '[公開]')).toBeNull();
    expect(extractPublicDescription('内部情報だけ')).toBeUndefined();
  });
});

describe('server safeguards', () => {
  it('requires all service account settings without leaking values', () => {
    expect(() => loadCalendarEnvironment({})).toThrowError(CalendarProviderError);
  });
  it('limits anonymous requests', () => {
    expect(allowChatRequest('test', 0, 2, 100)).toBe(true);
    expect(allowChatRequest('test', 1, 2, 100)).toBe(true);
    expect(allowChatRequest('test', 2, 2, 100)).toBe(false);
    expect(allowChatRequest('test', 101, 2, 100)).toBe(true);
  });
});
