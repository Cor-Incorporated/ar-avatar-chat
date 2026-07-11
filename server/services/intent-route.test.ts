import { describe, expect, it } from 'vitest';
import { classifyIntentRoute } from './intent-route.service.js';

describe('intent route classifier', () => {
  it.each(['こんにちは', 'ありがとう', '写真について教えて'])('routes ordinary chat: %s', (message) => {
    expect(classifyIntentRoute(message)).toEqual({ route: 'ordinary', signals: [] });
  });

  it.each(['今何時？', '今日は何曜日ですか', '現在の日時を教えて'])('routes temporal facts: %s', (message) => {
    expect(classifyIntentRoute(message).route).toBe('temporal');
  });

  it.each(['会社を紹介して', 'Cor.Incの事業内容は？', '代表者と所在地を教えて'])('routes company facts: %s', (message) => {
    expect(classifyIntentRoute(message).route).toBe('company');
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
});
