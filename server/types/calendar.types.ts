export type CalendarErrorCode =
  | 'calendar_not_configured'
  | 'calendar_unauthorized'
  | 'calendar_unavailable'
  | 'calendar_rate_limited'
  | 'invalid_calendar_range';

export type CalendarRangeKind = 'today' | 'tomorrow' | 'this_week' | 'explicit_range';

export interface CalendarQuery {
  kind: CalendarRangeKind;
  timeMin: string;
  timeMax: string;
  timezone: string;
  availabilityRequested: boolean;
}

export interface PublicCalendarEvent {
  title: string;
  start: string;
  end: string;
  publicDescription?: string;
}

export interface CalendarAvailability {
  busy: Array<{ start: string; end: string }>;
}

export interface CalendarResult {
  events: PublicCalendarEvent[];
  availability?: CalendarAvailability;
  queriedRange: { start: string; end: string; timezone: string };
}

export interface CalendarProvider {
  query(query: CalendarQuery): Promise<CalendarResult>;
}

export class CalendarProviderError extends Error {
  constructor(public readonly code: CalendarErrorCode, message: string, public readonly retryable = false) {
    super(message);
    this.name = 'CalendarProviderError';
  }
}
