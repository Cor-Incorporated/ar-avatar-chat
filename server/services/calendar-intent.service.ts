import type { CalendarQuery } from '../types/calendar.types.js';
import { CalendarProviderError } from '../types/calendar.types.js';

const CALENDAR_WORDS = /(?:カレンダー|予定|スケジュール|空き(?:時間)?|空いて|予約)/;
const MEETING_REQUEST = /(?:会議|打ち合わせ).*(?:いつ|今日|明日|今週|来週|時間|確認|予定|スケジュール|空き|ある|入って)/;
const GREETING_ONLY = /^(?:こんにちは|こんばんは|おはよう(?:ございます)?|やあ|はじめまして|お疲れさま(?:です)?)[！!。\s]*$/;
const NON_CALENDAR_STATEMENT = /(?:予定という|予定は未定|スケジュール管理の方法|予約機能|カレンダー機能)/;

export function isCalendarIntent(message: string): boolean {
  const text = message.trim();
  return !GREETING_ONLY.test(text) && !NON_CALENDAR_STATEMENT.test(text) && (CALENDAR_WORDS.test(text) || MEETING_REQUEST.test(text));
}

function jstMidnightUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, -9));
}

function jstDateParts(now: Date): [number, number, number] {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return [get('year'), get('month'), get('day')];
}

export function normalizeCalendarQuery(message: string, now = new Date(), timezone = 'Asia/Tokyo'): CalendarQuery {
  if (timezone !== 'Asia/Tokyo') timezone = 'Asia/Tokyo';
  const [year, month, day] = jstDateParts(now);
  let start = jstMidnightUtc(year, month, day);
  let end = new Date(start.getTime() + 86_400_000);
  let kind: CalendarQuery['kind'] = 'today';

  const explicit = message.match(/(?:(20\d{2})[年\/-])?(\d{1,2})[月\/-](\d{1,2})日?/);
  if (explicit) {
    const explicitYear = Number(explicit[1] || year);
    const explicitMonth = Number(explicit[2]);
    const explicitDay = Number(explicit[3]);
    const validation = new Date(Date.UTC(explicitYear, explicitMonth - 1, explicitDay));
    if (validation.getUTCFullYear() !== explicitYear || validation.getUTCMonth() !== explicitMonth - 1 || validation.getUTCDate() !== explicitDay) {
      throw new CalendarProviderError('invalid_calendar_range', 'Calendar date is invalid');
    }
    start = jstMidnightUtc(explicitYear, explicitMonth, explicitDay);
    end = new Date(start.getTime() + 86_400_000);
    kind = 'explicit_range';
  } else if (/明日/.test(message)) {
    start = new Date(start.getTime() + 86_400_000);
    end = new Date(start.getTime() + 86_400_000);
    kind = 'tomorrow';
  } else if (/今週/.test(message)) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    start = new Date(start.getTime() - (weekday === 0 ? 6 : weekday - 1) * 86_400_000);
    end = new Date(start.getTime() + 7 * 86_400_000);
    kind = 'this_week';
  }

  if (end.getTime() - start.getTime() > 31 * 86_400_000) throw new Error('calendar range exceeds 31 days');
  return { kind, timeMin: start.toISOString(), timeMax: end.toISOString(), timezone, availabilityRequested: /空き|空いて/.test(message) };
}
