import { google, type calendar_v3 } from 'googleapis';
import type { CalendarProvider, CalendarQuery, CalendarResult, PublicCalendarEvent } from '../types/calendar.types.js';
import { CalendarProviderError } from '../types/calendar.types.js';

interface CalendarEnvironment { clientEmail: string; privateKey: string; calendarId: string; timezone: string; publicPrefix: string }

export function loadCalendarEnvironment(env: NodeJS.ProcessEnv = process.env): CalendarEnvironment {
  const clientEmail = env.GOOGLE_CALENDAR_CLIENT_EMAIL?.trim();
  const privateKey = env.GOOGLE_CALENDAR_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  const calendarId = env.GOOGLE_CALENDAR_ID?.trim();
  if (!clientEmail || !privateKey || !calendarId) throw new CalendarProviderError('calendar_not_configured', 'Calendar server configuration is incomplete');
  return { clientEmail, privateKey, calendarId, timezone: env.GOOGLE_CALENDAR_TIMEZONE || 'Asia/Tokyo', publicPrefix: env.GOOGLE_CALENDAR_PUBLIC_PREFIX || '[公開]' };
}

export function extractPublicDescription(description?: string | null): string | undefined {
  if (!description) return undefined;
  const marker = '[公開説明]';
  const index = description.indexOf(marker);
  if (index < 0) return undefined;
  const value = description.slice(index + marker.length).trim().slice(0, 1000);
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

export class GoogleServiceAccountCalendarProvider implements CalendarProvider {
  constructor(private readonly config = loadCalendarEnvironment()) {}
  async query(query: CalendarQuery): Promise<CalendarResult> {
    const duration = Date.parse(query.timeMax) - Date.parse(query.timeMin);
    if (!(duration > 0) || duration > 31 * 86_400_000) throw new CalendarProviderError('invalid_calendar_range', 'Calendar range must be 31 days or less');
    const key = `${query.timeMin}:${query.timeMax}:${query.availabilityRequested}`;
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.result;
    const auth = new google.auth.JWT({ email: this.config.clientEmail, key: this.config.privateKey, scopes: ['https://www.googleapis.com/auth/calendar.readonly'] });
    const calendar = google.calendar({ version: 'v3', auth });
    try {
      const response = await Promise.race([
        calendar.events.list({ calendarId: this.config.calendarId, timeMin: query.timeMin, timeMax: query.timeMax, singleEvents: true, orderBy: 'startTime', maxResults: 250, timeZone: this.config.timezone }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('calendar_timeout')), 8000))
      ]);
      const raw = response.data.items || [];
      const result: CalendarResult = {
        events: raw.map((event) => sanitizePublicEvent(event, this.config.publicPrefix)).filter((event): event is PublicCalendarEvent => event !== null),
        availability: query.availabilityRequested ? { busy: raw.map((event) => ({ start: event.start?.dateTime || event.start?.date || '', end: event.end?.dateTime || event.end?.date || '' })).filter((slot) => slot.start && slot.end) } : undefined,
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
