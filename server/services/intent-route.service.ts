import { isCalendarIntent } from './calendar-intent.service.js';

export type IntentRoute = 'ordinary' | 'temporal' | 'company' | 'calendar' | 'mixed';

export interface IntentRouteResult {
  route: IntentRoute;
  signals: Array<Exclude<IntentRoute, 'ordinary' | 'mixed'>>;
}

const TEMPORAL_INTENT = /今(?:は)?何時|(?:今|現在)(?:の)?(?:時刻|時間|日時)|今日は(?:何日|何曜日)|(?:今日|現在)の日付/;
const COMPANY_INTENT = /Cor[.．]?Inc|コーア(?:インク)?|会社|企業|事業(?:内容)?|サービス|代表(?:者)?|所在地|沿革|採用/iu;

/** Calendarを単独経路に保ちつつ、複数領域を要求する質問をmixedへ分離する。 */
export function classifyIntentRoute(message: string): IntentRouteResult {
  const normalized = message.trim();
  const signals: IntentRouteResult['signals'] = [];
  if (isCalendarIntent(normalized)) signals.push('calendar');
  if (TEMPORAL_INTENT.test(normalized)) signals.push('temporal');
  if (COMPANY_INTENT.test(normalized)) signals.push('company');

  if (signals.length > 1) return { route: 'mixed', signals };
  return { route: signals[0] ?? 'ordinary', signals };
}
