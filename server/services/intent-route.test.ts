import { describe, expect, it } from 'vitest';
import { classifyIntentRoute } from './intent-route.service.js';

describe('intent route classifier', () => {
  it.each(['こんにちは', 'ありがとう', '写真について教えて'])('routes ordinary chat: %s', (message) => {
    expect(classifyIntentRoute(message)).toEqual({ route: 'ordinary', signals: [] });
  });

  it.each(['他の会社に転職しようか迷ってる', 'このサービス使いやすいね', '事業を始めた友人へ贈り物をしたい'])('does not treat generic company words as Cor.Inc facts: %s', (message) => {
    expect(classifyIntentRoute(message)).toEqual({ route: 'ordinary', signals: [] });
  });

  it.each(['コアラが好き', 'コアタイムは何時から？', 'コアな趣味について教えて'])('does not treat words containing コア as the company identity: %s', (message) => {
    expect(classifyIntentRoute(message)).toEqual({ route: 'ordinary', signals: [] });
  });

  it.each(['今何時？', '今日は何曜日ですか', '今日何日？', '現在の日時を教えて'])('routes temporal facts: %s', (message) => {
    expect(classifyIntentRoute(message).route).toBe('temporal');
  });

  it.each(['会社を紹介して', 'Cor.Incの事業内容は？', 'Cor Incについて教えて', 'コアインクについて教えて', '御社の代表者と所在地を教えて'])('routes company facts: %s', (message) => {
    expect(classifyIntentRoute(message).route).toBe('company');
  });

  it.each(['会社概要', '会社説明'])('routes company overview aliases: %s', (message) => {
    expect(classifyIntentRoute(message).route).toBe('company');
  });

  it.each(['友達の会社のサービスについて教えて', '転職先の会社の福利厚生について教えて', 'このサブスクリプションサービスって解約できますか？'])('does not claim unrelated company questions: %s', (message) => {
    expect(classifyIntentRoute(message)).toEqual({ route: 'ordinary', signals: [] });
  });

  it.each(['予約したい', 'サービスの予約方法を教えて', '採用説明会はいつ？', '採用面談の日程は？'])('keeps non-calendar operational questions ordinary: %s', (message) => {
    expect(classifyIntentRoute(message)).toEqual({ route: 'ordinary', signals: [] });
  });

  it('treats company roadmap language as company knowledge, not Calendar', () => {
    expect(classifyIntentRoute('会社の今後の予定を教えて')).toEqual({ route: 'company', signals: ['company'] });
  });

  it.each(['明日の公開予定を教えて', '今週の空き時間は？'])('routes explicit calendar queries: %s', (message) => {
    expect(classifyIntentRoute(message).route).toBe('calendar');
  });

  it('routes multi-domain requests without discarding either signal', () => {
    expect(classifyIntentRoute('会社を紹介して、来週の公開予定も教えて')).toEqual({
      route: 'mixed',
      signals: ['calendar', 'company'],
    });
    expect(classifyIntentRoute('現在の日時と今日の公開予定を教えて')).toEqual({
      route: 'mixed',
      signals: ['calendar', 'temporal'],
    });
  });

  it.each([
    '来週の公開予定も教えて、あと会社を紹介して',
    '今週の空き時間を教えて、あと会社概要も教えて',
  ])('keeps a trailing unqualified company clause: %s', (message) => {
    expect(classifyIntentRoute(message)).toEqual({ route: 'mixed', signals: ['calendar', 'company'] });
  });

  it.each([
    '会社の今後の予定を教えて、あと来週の公開イベントを教えて',
    'デモを予約したい、あと来週の公開予定を教えて',
  ])('keeps an explicit Calendar clause despite suppression words elsewhere: %s', (message) => {
    expect(classifyIntentRoute(message).signals).toContain('calendar');
  });
});
