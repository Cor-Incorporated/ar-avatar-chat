import { describe, expect, it } from 'vitest';
import { isCalendarIntent, normalizeCalendarQuery } from './calendar-intent.service.js';
import { calculatePublicAvailability, calendarCacheKey, collectCalendarEvents, createCalendarProvider, expandIcalEvents, extractPublicDescription, loadCalendarEnvironment, loadIcalEnvironment, PrivateIcalCalendarProvider, resetDefaultCalendarProviderForTesting, sanitizePublicEvent } from './google-calendar.service.js';
import ical from 'node-ical';
import { CalendarProviderError } from '../types/calendar.types.js';
import { allowChatRequest, normalizeClientIp } from './rate-limit.service.js';
import { toPublicCalendarAction } from './gemini.service.js';

describe('calendar intent', () => {
  it.each(['こんにちは', 'おはようございます！', '会社を紹介して'])('does not route ordinary chat: %s', (message) => expect(isCalendarIntent(message)).toBe(false));
  it.each(['明日の公開予定を教えて', '今週の空き時間は？', '会議のスケジュールを確認して'])('routes explicit calendar requests: %s', (message) => expect(isCalendarIntent(message)).toBe(true));
  it.each(['会議の進め方を教えて', '予約機能を説明して', '予定は未定です', '今後の予定はまだ未定です、詳しくは追ってご連絡します'])('does not route calendar-related ordinary chat: %s', (message) => expect(isCalendarIntent(message)).toBe(false));
  it('normalizes tomorrow in JST', () => {
    const query = normalizeCalendarQuery('明日の予定', new Date('2026-07-10T16:00:00Z'));
    expect(query.timeMin).toBe('2026-07-11T15:00:00.000Z');
    expect(query.timeMax).toBe('2026-07-12T15:00:00.000Z');
  });
  it('rejects non-Tokyo request timezones instead of silently coercing them', () => {
    expect(() => normalizeCalendarQuery('明日の予定', new Date(), 'UTC')).toThrowError('Calendar timezone must be Asia/Tokyo');
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
  it('accepts only year-qualified slash/hyphen dates and ignores phone-number fragments', () => {
    expect(normalizeCalendarQuery('2026-07-15の予定').timeMin).toBe('2026-07-14T15:00:00.000Z');
    expect(normalizeCalendarQuery('2026/07/15の予定').timeMin).toBe('2026-07-14T15:00:00.000Z');
    const weekly = normalizeCalendarQuery('今週の予定を教えて、090-1234-5678にも連絡して', new Date('2026-07-10T16:00:00Z'));
    expect(weekly.kind).toBe('this_week');
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
    expect(sanitizePublicEvent({ summary: '[公開] 中止イベント', status: 'cancelled' }, '[公開]')).toBeNull();
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

describe('private iCal provider', () => {
  const fixture = `BEGIN:VCALENDAR\r
VERSION:2.0\r
PRODID:-//Cor//Calendar Test//JA\r
BEGIN:VEVENT\r
UID:public-recurring\r
DTSTART;TZID=Asia/Tokyo:20260713T100000\r
DTEND;TZID=Asia/Tokyo:20260713T110000\r
RRULE:FREQ=DAILY;COUNT=2\r
SUMMARY:[公開] 相談会\r
DESCRIPTION:内部情報\\n[公開説明]\\n一般公開です\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:private-all-day\r
DTSTART;VALUE=DATE:20260714\r
DTEND;VALUE=DATE:20260715\r
SUMMARY:社内休業\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:cancelled-public\r
DTSTART;TZID=Asia/Tokyo:20260716T100000\r
DTEND;TZID=Asia/Tokyo:20260716T110000\r
SUMMARY:[公開] 中止イベント\r
STATUS:CANCELLED\r
END:VEVENT\r
END:VCALENDAR`;
  const query = { kind: 'this_week', timeMin: '2026-07-12T15:00:00.000Z', timeMax: '2026-07-19T15:00:00.000Z', timezone: 'Asia/Tokyo', availabilityRequested: true } as const;

  it('expands recurrence and preserves all-day boundaries', async () => {
    const events = expandIcalEvents(await ical.async.parseICS(fixture), query);
    expect(events.filter((event) => event.summary === '[公開] 相談会')).toHaveLength(2);
    expect(events.find((event) => event.summary === '社内休業')).toMatchObject({ start: { date: '2026-07-14' }, end: { date: '2026-07-15' } });
  });

  it('applies the shared publication and free-slot boundary to fetched ICS', async () => {
    const fetcher = async () => new Response(fixture, { status: 200, headers: { 'content-type': 'text/calendar' } });
    const provider = new PrivateIcalCalendarProvider({ url: 'https://calendar.example.test/private.ics', timezone: 'Asia/Tokyo', publicPrefix: '[公開]', businessStart: '09:00', businessEnd: '18:00' }, fetcher as typeof fetch);
    const result = await provider.query(query);
    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toMatchObject({ title: '相談会', publicDescription: '一般公開です' });
    expect(JSON.stringify(result)).not.toContain('社内休業');
    expect(JSON.stringify(result)).not.toContain('中止イベント');
    expect(result.availability?.free.length).toBeGreaterThan(0);
  });

  it('prefers the server-only iCal URL and never uses the legacy VITE value as a provider URL', () => {
    const config = loadIcalEnvironment({ GOOGLE_CALENDAR_ICAL_URL: 'https://calendar.example.test/private.ics' });
    expect(config?.url).toBe('https://calendar.example.test/private.ics');
    expect(createCalendarProvider({ GOOGLE_CALENDAR_ICAL_URL: 'https://calendar.example.test/private.ics', VITE_GOOGLE_CALENDAR_ICAL_URL: 'https://legacy.invalid/secret.ics' })).toBeInstanceOf(PrivateIcalCalendarProvider);
    expect(() => createCalendarProvider({ VITE_GOOGLE_CALENDAR_ICAL_URL: 'https://legacy.invalid/secret.ics' })).toThrowError(CalendarProviderError);
  });

  it('reuses the process-env provider and its cache across factory calls', async () => {
    const previous = process.env.GOOGLE_CALENDAR_ICAL_URL;
    process.env.GOOGLE_CALENDAR_ICAL_URL = 'https://calendar.example.test/private.ics';
    resetDefaultCalendarProviderForTesting();
    let fetchCount = 0;
    const fetcher = async () => {
      fetchCount += 1;
      return new Response(fixture, { status: 200, headers: { 'content-type': 'text/calendar' } });
    };
    try {
      const first = createCalendarProvider(process.env, fetcher as typeof fetch);
      await first.query(query);
      const second = createCalendarProvider(process.env, fetcher as typeof fetch);
      await second.query(query);
      expect(second).toBe(first);
      expect(fetchCount).toBe(1);
    } finally {
      resetDefaultCalendarProviderForTesting();
      if (previous === undefined) delete process.env.GOOGLE_CALENDAR_ICAL_URL;
      else process.env.GOOGLE_CALENDAR_ICAL_URL = previous;
    }
  });
});

describe('server safeguards', () => {
  it.each([
    ['calendar_not_configured', false],
    ['calendar_unauthorized', false],
    ['invalid_calendar_range', false],
    ['calendar_rate_limited', true],
    ['calendar_unavailable', true],
  ] as const)('maps internal %s errors to a coarse public action', (code, retryable) => {
    expect(toPublicCalendarAction(new CalendarProviderError(code, 'internal detail', retryable))).toEqual({
      type: 'retry', reason: 'calendar_unavailable', retryable,
    });
  });
  it('treats unknown failures as transient without exposing details', () => {
    expect(toPublicCalendarAction(new Error('secret'))).toEqual({
      type: 'retry', reason: 'calendar_unavailable', retryable: true,
    });
  });
  it('requires all service account settings without leaking values', () => {
    expect(() => loadCalendarEnvironment({})).toThrowError(CalendarProviderError);
  });
  it('rejects non-Tokyo calendar configuration with a timezone-specific error', () => {
    expect(() => loadCalendarEnvironment({
      GOOGLE_CALENDAR_CLIENT_EMAIL: 'reader@example.test',
      GOOGLE_CALENDAR_PRIVATE_KEY: 'private-key',
      GOOGLE_CALENDAR_ID: 'calendar@example.test',
      GOOGLE_CALENDAR_TIMEZONE: 'UTC',
    })).toThrowError('GOOGLE_CALENDAR_TIMEZONE must be Asia/Tokyo');
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
    expect(normalizeClientIp('::ffff:203.0.113.10')).toBe('203.0.113.10');
    expect(normalizeClientIp('999.0.0.1')).toBeNull();
    expect(normalizeClientIp('spoofed-client')).toBeNull();
  });
});
