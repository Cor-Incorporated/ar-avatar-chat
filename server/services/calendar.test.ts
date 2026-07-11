import { describe, expect, it } from 'vitest';
import { isCalendarIntent, normalizeCalendarQuery } from './calendar-intent.service.js';
import { calculatePublicAvailability, calendarCacheKey, collectCalendarEvents, extractPublicDescription, loadCalendarEnvironment, sanitizePublicEvent } from './google-calendar.service.js';
import { CalendarProviderError } from '../types/calendar.types.js';
import { allowChatRequest, normalizeClientIp } from './rate-limit.service.js';

describe('calendar intent', () => {
  it.each(['こんにちは', 'おはようございます！', '会社を紹介して'])('does not route ordinary chat: %s', (message) => expect(isCalendarIntent(message)).toBe(false));
  it.each(['明日の公開予定を教えて', '今週の空き時間は？', '会議のスケジュール'])('routes explicit calendar requests: %s', (message) => expect(isCalendarIntent(message)).toBe(true));
  it.each(['会議の進め方を教えて', '予約機能を説明して', '予定は未定です'])('does not route calendar-related ordinary chat: %s', (message) => expect(isCalendarIntent(message)).toBe(false));
  it('normalizes tomorrow in JST', () => {
    const query = normalizeCalendarQuery('明日の予定', new Date('2026-07-10T16:00:00Z'));
    expect(query.timeMin).toBe('2026-07-11T15:00:00.000Z');
    expect(query.timeMax).toBe('2026-07-12T15:00:00.000Z');
  });
  it('normalizes next week from JST Monday through the following Monday', () => {
    const query = normalizeCalendarQuery('来週の予定', new Date('2026-07-10T16:00:00Z'));
    expect(query.kind).toBe('next_week');
    expect(query.timeMin).toBe('2026-07-12T15:00:00.000Z');
    expect(query.timeMax).toBe('2026-07-19T15:00:00.000Z');
  });
  it('routes a concrete request even when it mentions a calendar feature', () => {
    expect(isCalendarIntent('予約機能で明日の予定を確認して')).toBe(true);
    expect(isCalendarIntent('予約機能を説明して')).toBe(false);
  });
  it('accepts a Japanese date without a year and rejects an impossible date', () => {
    const query = normalizeCalendarQuery('7月15日の予定', new Date('2026-07-10T00:00:00Z'));
    expect(query.timeMin).toBe('2026-07-14T15:00:00.000Z');
    expect(() => normalizeCalendarQuery('2026年2月31日の予定')).toThrowError(CalendarProviderError);
  });
});

describe('public boundary', () => {
  it('only exposes prefixed event fields and public description suffix', () => {
    const event = sanitizePublicEvent({ summary: '[公開] 相談会', description: '内部情報\n[公開説明]\nどなたでも参加できます', location: 'SECRET', attendees: [{ email: 'secret@example.com' }], start: { dateTime: '2026-07-12T10:00:00+09:00' }, end: { dateTime: '2026-07-12T11:00:00+09:00' } }, '[公開]');
    expect(event).toEqual({ title: '相談会', start: '2026-07-12T10:00:00+09:00', end: '2026-07-12T11:00:00+09:00', publicDescription: 'どなたでも参加できます' });
    expect(JSON.stringify(event)).not.toContain('SECRET');
    expect(JSON.stringify(event)).not.toContain('secret@example.com');
  });
  it('removes Google meeting links even from an explicitly public description', () => {
    expect(extractPublicDescription('[公開説明]\n参加URL https://meet.google.com/secret-room')).toBe('参加URL');
  });
  it('hides unprefixed events and descriptions without marker', () => {
    expect(sanitizePublicEvent({ summary: '役員会' }, '[公開]')).toBeNull();
    expect(extractPublicDescription('内部情報だけ')).toBeUndefined();
  });
  it('converts private busy periods to weekday business-hour free slots', () => {
    const availability = calculatePublicAvailability([
      { summary: '非公開', start: { dateTime: '2026-07-13T10:00:00+09:00' }, end: { dateTime: '2026-07-13T11:00:00+09:00' } },
      { transparency: 'transparent', start: { dateTime: '2026-07-13T12:00:00+09:00' }, end: { dateTime: '2026-07-13T13:00:00+09:00' } },
      { status: 'cancelled', start: { dateTime: '2026-07-13T14:00:00+09:00' }, end: { dateTime: '2026-07-13T15:00:00+09:00' } },
    ], {
      kind: 'explicit_range',
      timeMin: '2026-07-12T15:00:00.000Z',
      timeMax: '2026-07-13T15:00:00.000Z',
      timezone: 'Asia/Tokyo',
      availabilityRequested: true,
    });
    expect(availability.free).toEqual([
      { start: '2026-07-13T00:00:00.000Z', end: '2026-07-13T01:00:00.000Z' },
      { start: '2026-07-13T02:00:00.000Z', end: '2026-07-13T09:00:00.000Z' },
    ]);
    expect(JSON.stringify(availability)).not.toContain('非公開');
  });
  it('omits free periods shorter than 30 minutes', () => {
    const availability = calculatePublicAvailability([
      { start: { dateTime: '2026-07-13T09:20:00+09:00' }, end: { dateTime: '2026-07-13T18:00:00+09:00' } },
    ], {
      kind: 'explicit_range', timeMin: '2026-07-12T15:00:00.000Z', timeMax: '2026-07-13T15:00:00.000Z', timezone: 'Asia/Tokyo', availabilityRequested: true,
    });
    expect(availability.free).toEqual([]);
  });
  it('collects every Google Calendar page', async () => {
    const requestedTokens: Array<string | undefined> = [];
    const events = await collectCalendarEvents(async (token) => {
      requestedTokens.push(token);
      return token ? { items: [{ summary: 'second' }] } : { items: [{ summary: 'first' }], nextPageToken: 'page-2' };
    });
    expect(events.map((event) => event.summary)).toEqual(['first', 'second']);
    expect(requestedTokens).toEqual([undefined, 'page-2']);
  });
  it('isolates cache identities by calendar and publication policy', () => {
    const query = { kind: 'today', timeMin: '2026-07-10T15:00:00.000Z', timeMax: '2026-07-11T15:00:00.000Z', timezone: 'Asia/Tokyo', availabilityRequested: true } as const;
    const base = { clientEmail: 'reader', privateKey: 'key', calendarId: 'calendar-a', timezone: 'Asia/Tokyo', publicPrefix: '[公開]', businessStart: '09:00', businessEnd: '18:00' };
    expect(calendarCacheKey(base, query)).not.toBe(calendarCacheKey({ ...base, calendarId: 'calendar-b' }, query));
    expect(calendarCacheKey(base, query)).not.toBe(calendarCacheKey({ ...base, publicPrefix: '[外部]' }, query));
  });
});

describe('server safeguards', () => {
  it('requires all service account settings without leaking values', () => {
    expect(() => loadCalendarEnvironment({})).toThrowError(CalendarProviderError);
  });
  it('validates and accepts configurable business hours', () => {
    const config = loadCalendarEnvironment({
      GOOGLE_CALENDAR_CLIENT_EMAIL: 'reader@example.test', GOOGLE_CALENDAR_PRIVATE_KEY: 'key', GOOGLE_CALENDAR_ID: 'calendar',
      GOOGLE_CALENDAR_BUSINESS_START: '10:00', GOOGLE_CALENDAR_BUSINESS_END: '17:30',
    });
    expect(config).toMatchObject({ businessStart: '10:00', businessEnd: '17:30', timezone: 'Asia/Tokyo' });
    expect(() => loadCalendarEnvironment({
      GOOGLE_CALENDAR_CLIENT_EMAIL: 'reader@example.test', GOOGLE_CALENDAR_PRIVATE_KEY: 'key', GOOGLE_CALENDAR_ID: 'calendar',
      GOOGLE_CALENDAR_BUSINESS_START: '18:00', GOOGLE_CALENDAR_BUSINESS_END: '09:00',
    })).toThrowError(CalendarProviderError);
  });
  it('limits anonymous requests', () => {
    expect(allowChatRequest('test', 0, 2, 100)).toBe(true);
    expect(allowChatRequest('test', 1, 2, 100)).toBe(true);
    expect(allowChatRequest('test', 2, 2, 100)).toBe(false);
    expect(allowChatRequest('test', 101, 2, 100)).toBe(true);
  });
  it('accepts only normalized IP-shaped rate-limit keys', () => {
    expect(normalizeClientIp('203.0.113.10, 10.0.0.1')).toBe('203.0.113.10');
    expect(normalizeClientIp('2001:db8::1')).toBe('2001:db8::1');
    expect(normalizeClientIp('spoofed-client')).toBeNull();
  });
});
