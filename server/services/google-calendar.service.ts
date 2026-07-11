import { google, type calendar_v3 } from 'googleapis';
import type { CalendarAvailability, CalendarProvider, CalendarQuery, CalendarResult, PublicCalendarEvent } from '../types/calendar.types.js';
import { CalendarProviderError } from '../types/calendar.types.js';

interface CalendarEnvironment {
  clientEmail: string;
  privateKey: string;
  calendarId: string;
  timezone: string;
  publicPrefix: string;
  businessStart: string;
  businessEnd: string;
}

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const MINIMUM_FREE_SLOT_MS = 30 * 60_000;

export function loadCalendarEnvironment(env: NodeJS.ProcessEnv = process.env): CalendarEnvironment {
  const clientEmail = env.GOOGLE_CALENDAR_CLIENT_EMAIL?.trim();
  const privateKey = env.GOOGLE_CALENDAR_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  const calendarId = env.GOOGLE_CALENDAR_ID?.trim();
  if (!clientEmail || !privateKey || !calendarId) throw new CalendarProviderError('calendar_not_configured', 'Calendar server configuration is incomplete');
  const timezone = env.GOOGLE_CALENDAR_TIMEZONE?.trim() || 'Asia/Tokyo';
  const businessStart = env.GOOGLE_CALENDAR_BUSINESS_START?.trim() || '09:00';
  const businessEnd = env.GOOGLE_CALENDAR_BUSINESS_END?.trim() || '18:00';
  if (timezone !== 'Asia/Tokyo' || !TIME_PATTERN.test(businessStart) || !TIME_PATTERN.test(businessEnd) || businessStart >= businessEnd) {
    throw new CalendarProviderError('calendar_not_configured', 'Calendar business hours configuration is invalid');
  }
  return { clientEmail, privateKey, calendarId, timezone, publicPrefix: env.GOOGLE_CALENDAR_PUBLIC_PREFIX || '[公開]', businessStart, businessEnd };
}

export function extractPublicDescription(description?: string | null): string | undefined {
  if (!description) return undefined;
  const marker = '[公開説明]';
  const index = description.indexOf(marker);
  if (index < 0) return undefined;
  const value = description
    .slice(index + marker.length)
    .replace(/https:\/\/(?:meet\.google\.com|hangouts\.google\.com)\/\S+/giu, '')
    .trim()
    .slice(0, 1000);
  return value || undefined;
}

export function sanitizePublicEvent(event: calendar_v3.Schema$Event, prefix: string): PublicCalendarEvent | null {
  const summary = event.summary || '';
  if (!summary.startsWith(prefix)) return null;
  const title = summary.slice(prefix.length).trim();
  if (!title) return null;
  return { title, start: event.start?.dateTime || event.start?.date || '', end: event.end?.dateTime || event.end?.date || '', publicDescription: extractPublicDescription(event.description) };
}

const cache = new Map<string, { expires: number; result: CalendarResult }>();

type CalendarPage = { items?: calendar_v3.Schema$Event[] | null; nextPageToken?: string | null };

export async function collectCalendarEvents(fetchPage: (pageToken?: string) => Promise<CalendarPage>): Promise<calendar_v3.Schema$Event[]> {
  const events: calendar_v3.Schema$Event[] = [];
  let pageToken: string | undefined;
  do {
    const page = await fetchPage(pageToken);
    events.push(...(page.items || []));
    pageToken = page.nextPageToken || undefined;
  } while (pageToken);
  return events;
}

function eventInterval(event: calendar_v3.Schema$Event): { start: number; end: number } | null {
  if (event.status === 'cancelled' || event.transparency === 'transparent') return null;
  const start = Date.parse(event.start?.dateTime || event.start?.date || '');
  const end = Date.parse(event.end?.dateTime || event.end?.date || '');
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}

function jstDayStart(timestamp: number): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(value('year'), value('month') - 1, value('day'), -9);
}

function timeOffset(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60 + minutes) * 60_000;
}

export function calculatePublicAvailability(
  events: calendar_v3.Schema$Event[],
  query: CalendarQuery,
  businessStart = '09:00',
  businessEnd = '18:00',
): CalendarAvailability {
  const rangeStart = Date.parse(query.timeMin);
  const rangeEnd = Date.parse(query.timeMax);
  const busy = events.map(eventInterval).filter((slot): slot is { start: number; end: number } => slot !== null);
  const free: Array<{ start: string; end: string }> = [];

  for (let day = jstDayStart(rangeStart); day < rangeEnd; day += 86_400_000) {
    const weekday = new Date(day + 9 * 3_600_000).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const windowStart = Math.max(rangeStart, day + timeOffset(businessStart));
    const windowEnd = Math.min(rangeEnd, day + timeOffset(businessEnd));
    if (windowEnd <= windowStart) continue;

    const overlaps = busy
      .filter((slot) => slot.end > windowStart && slot.start < windowEnd)
      .map((slot) => ({ start: Math.max(slot.start, windowStart), end: Math.min(slot.end, windowEnd) }))
      .sort((a, b) => a.start - b.start);
    let cursor = windowStart;
    for (const slot of overlaps) {
      if (slot.start - cursor >= MINIMUM_FREE_SLOT_MS) free.push({ start: new Date(cursor).toISOString(), end: new Date(slot.start).toISOString() });
      cursor = Math.max(cursor, slot.end);
    }
    if (windowEnd - cursor >= MINIMUM_FREE_SLOT_MS) free.push({ start: new Date(cursor).toISOString(), end: new Date(windowEnd).toISOString() });
  }
  return { free };
}

export class GoogleServiceAccountCalendarProvider implements CalendarProvider {
  constructor(private readonly config = loadCalendarEnvironment()) {}
  async query(query: CalendarQuery): Promise<CalendarResult> {
    const duration = Date.parse(query.timeMax) - Date.parse(query.timeMin);
    if (!(duration > 0) || duration > 31 * 86_400_000) throw new CalendarProviderError('invalid_calendar_range', 'Calendar range must be 31 days or less');
    const key = calendarCacheKey(this.config, query);
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.result;
    const auth = new google.auth.JWT({ email: this.config.clientEmail, key: this.config.privateKey, scopes: ['https://www.googleapis.com/auth/calendar.readonly'] });
    const calendar = google.calendar({ version: 'v3', auth });
    try {
      const deadline = Date.now() + 8000;
      const raw = await collectCalendarEvents(async (pageToken) => {
        if (Date.now() >= deadline) throw new Error('calendar_timeout');
        const response = await calendar.events.list({
          calendarId: this.config.calendarId,
          timeMin: query.timeMin,
          timeMax: query.timeMax,
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 250,
          timeZone: this.config.timezone,
          pageToken,
        }, { timeout: Math.max(1, deadline - Date.now()) });
        return response.data;
      });
      const result: CalendarResult = {
        events: raw.map((event) => sanitizePublicEvent(event, this.config.publicPrefix)).filter((event): event is PublicCalendarEvent => event !== null),
        availability: query.availabilityRequested
          ? calculatePublicAvailability(raw, query, this.config.businessStart, this.config.businessEnd)
          : undefined,
        queriedRange: { start: query.timeMin, end: query.timeMax, timezone: this.config.timezone }
      };
      cache.set(key, { expires: Date.now() + 60_000, result });
      return result;
    } catch (error: any) {
      const status = error?.code || error?.response?.status;
      if (status === 401 || status === 403) throw new CalendarProviderError('calendar_unauthorized', 'Calendar access is not authorized');
      if (status === 429) throw new CalendarProviderError('calendar_rate_limited', 'Calendar rate limit exceeded', true);
      throw new CalendarProviderError('calendar_unavailable', 'Calendar is temporarily unavailable', true);
    }
  }
}

export function calendarCacheKey(config: CalendarEnvironment, query: CalendarQuery): string {
  return [config.calendarId, config.timezone, config.publicPrefix, config.businessStart, config.businessEnd, query.timeMin, query.timeMax, query.availabilityRequested].join(':');
}
