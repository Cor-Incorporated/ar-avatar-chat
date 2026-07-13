import { createCalendarProvider } from '../dist/services/google-calendar.service.js';

if (!process.env.GOOGLE_CALENDAR_ICAL_URL) {
  throw new Error('Calendar live probe secret is not configured');
}

const now = new Date();
const query = {
  kind: 'today',
  timeMin: now.toISOString(),
  timeMax: new Date(now.getTime() + 60 * 60_000).toISOString(),
  timezone: 'Asia/Tokyo',
  availabilityRequested: false,
};

await createCalendarProvider().query(query);
console.log('Calendar live probe succeeded.');
