import { isCalendarIntent } from './calendar-intent.service.js';

export type IntentRoute = 'ordinary' | 'temporal' | 'company' | 'calendar' | 'mixed';

export interface IntentRouteResult {
  route: IntentRoute;
  signals: Array<Exclude<IntentRoute, 'ordinary' | 'mixed'>>;
}

export function splitIntentClauses(message: string): string[] {
  return message.split(/(?:[、。,，？?!！]|\n|(?:それと|そして|あと))/u).map((clause) => clause.trim()).filter(Boolean);
}

const TEMPORAL_INTENT = /今(?:は)?何時|(?:今|現在)(?:の)?(?:時刻|時間|日時)|今日(?:は)?(?:何日|何曜日)|(?:今日|現在)の日付/;
const COMPANY_IDENTITY = /Cor(?:[.．]|\s)?Inc|コー?アインク|御社|貴社/iu;
const COMPANY_UNQUALIFIED_REQUEST = /^(?:(?:この|そちらの)?(?:会社|企業)(?:を|の|について|概要|説明)|(?:会社概要|会社説明|事業内容|代表者|所在地|沿革|採用情報)(?:を|は|について|と)?)/;
const INFORMATION_REQUEST = /教えて|紹介|知りたい|どんな|何(?:を|の|者|ですか)?|について|ありますか|していますか|[?？]/;
const GENERIC_RESERVATION = /(?:サービスの予約方法|予約(?:する|したい|方法|機能|手順))/;
const COMPANY_FUTURE_PLANS = /今後の予定/;
const COMPANY_OVERVIEW = /^(?:会社概要|会社説明)$/;

/** Calendarを単独経路に保ちつつ、複数領域を要求する質問をmixedへ分離する。 */
export function classifyIntentRoute(message: string): IntentRouteResult {
  const normalized = message.trim();
  const clauses = splitIntentClauses(normalized);
  const signals: IntentRouteResult['signals'] = [];
  const companyIntent = COMPANY_IDENTITY.test(normalized) || COMPANY_OVERVIEW.test(normalized)
    || (COMPANY_UNQUALIFIED_REQUEST.test(normalized) && INFORMATION_REQUEST.test(normalized));
  const calendarIntent = clauses.some((clause) =>
    isCalendarIntent(clause)
    && !GENERIC_RESERVATION.test(clause)
    && !(COMPANY_FUTURE_PLANS.test(clause) && (COMPANY_IDENTITY.test(clause) || COMPANY_UNQUALIFIED_REQUEST.test(clause))));
  if (calendarIntent) signals.push('calendar');
  if (TEMPORAL_INTENT.test(normalized)) signals.push('temporal');
  if (companyIntent) signals.push('company');

  if (signals.length > 1) return { route: 'mixed', signals };
  return { route: signals[0] ?? 'ordinary', signals };
}
