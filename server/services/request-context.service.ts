import type { GeminiResponse, RequestContext, TemporalFact } from '../types/chat.types.js';

const SUPPORTED_TIMEZONE = 'Asia/Tokyo' as const;
const SUPPORTED_LOCALE = 'ja-JP' as const;
const ALLOWED_GEMINI_MODELS = new Set(['gemini-3.1-flash-lite']);

export function createRequestContext(now = new Date(), timezone: string = SUPPORTED_TIMEZONE): RequestContext {
  if (timezone !== SUPPORTED_TIMEZONE) throw new Error('timezone_not_supported');
  if (!Number.isFinite(now.getTime())) throw new Error('invalid_request_time');
  return { now: new Date(now.getTime()), timezone: SUPPORTED_TIMEZONE, locale: SUPPORTED_LOCALE };
}

export function getGeminiModel(env: NodeJS.ProcessEnv = process.env): string {
  const model = env.GEMINI_MODEL?.trim();
  if (!model) throw new Error('GEMINI_MODEL is required');
  if (!ALLOWED_GEMINI_MODELS.has(model)) throw new Error(`GEMINI_MODEL is not allowed: ${model}`);
  return model;
}

function temporalParts(context: RequestContext): Omit<TemporalFact, 'kind'> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: context.timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(context.now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return {
    isoInstant: context.now.toISOString(), timezone: context.timezone,
    year: value('year'), month: value('month'), day: value('day'),
    weekday: new Intl.DateTimeFormat(context.locale, {
      timeZone: context.timezone,
      weekday: 'long',
    }).format(context.now),
    hour: value('hour'), minute: value('minute'),
  };
}

export function resolveTemporalFact(prompt: string, context: RequestContext): TemporalFact | null {
  const text = prompt.trim();
  const suffix = String.raw`(?:ですか|でしょうか|だっけ|か(?:知りたい|教えて(?:ほしい|ください)?|な))?[？?。！!\s]*$`;
  const kind = new RegExp(String.raw`^(?:(?:今|現在)(?:の)?(?:時刻|時間)|(?:今|いま)何時)${suffix}`).test(text)
    ? 'current_time'
    : new RegExp(String.raw`^(?:(?:今年|現在|今)(?:は|の)?何年|西暦何年)${suffix}`).test(text)
      ? 'current_year'
      : new RegExp(String.raw`^(?:(?:今日|本日)(?:は|の)?(?:何日|何曜日|日付)|今日はいつ)${suffix}`).test(text)
        ? 'current_date'
        : null;
  return kind ? { kind, ...temporalParts(context) } : null;
}

export function temporalFactResponse(fact: TemporalFact): GeminiResponse {
  if (fact.kind === 'current_time') {
    return { text: `今は${fact.year}年${fact.month}月${fact.day}日 ${String(fact.hour).padStart(2, '0')}:${String(fact.minute).padStart(2, '0')}（日本時間）ばい！`, emotion: 'neutral' };
  }
  if (fact.kind === 'current_year') return { text: `今年は${fact.year}年ばい！`, emotion: 'neutral' };
  return { text: `今日は${fact.year}年${fact.month}月${fact.day}日、${fact.weekday}ばい！`, emotion: 'neutral' };
}

export function buildCurrentTimeInstruction(context: RequestContext): string {
  const parts = temporalParts(context);
  return `現在日時は${parts.year}年${parts.month}月${parts.day}日、${parts.weekday}、${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}（${context.timezone}）です。日時と曜日については会話履歴やモデル知識ではなく、この値だけを根拠にしてください。`;
}
