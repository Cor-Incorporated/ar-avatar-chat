import type { CalendarQuery } from '../types/calendar.types.js';

const CALENDAR_WORDS = /(?:カレンダー|予定|スケジュール|空き(?:時間)?|空いて|会議|打ち合わせ|予約)/;
const GREETING_ONLY = /^(?:こんにちは|こんばんは|おはよう(?:ございます)?|やあ|はじめまして|お疲れさま(?:です)?)[！!。\s]*$/;

export function isCalendarIntent(message: string): boolean {
  const text = message.trim();
  return !GREETING_ONLY.test(text) && CALENDAR_WORDS.test(text);
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

  const explicit = message.match(/(20\d{2})[年\/-](\d{1,2})[月\/-](\d{1,2})日?/);
  if (explicit) {
    start = jstMidnightUtc(Number(explicit[1]), Number(explicit[2]), Number(explicit[3]));
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
