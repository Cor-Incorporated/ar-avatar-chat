import type { KnowledgeEntry } from './types.js';

const verifiedAt = '2026-07-11';

export const SERVICE_KNOWLEDGE: readonly KnowledgeEntry[] = [
  {
    id: 'service.ar', category: 'service', title: 'マーカー型WebAR',
    answer: '名刺のペンギンロゴをカメラで検出し、その位置に3Dアバターを表示します。利用にはカメラ権限が必要です。',
    aliases: ['AR機能', 'マーカー機能', '名刺で何ができる', 'ペンギンロゴ'],
    keywords: ['AR', 'マーカー', '名刺', 'ペンギン', 'カメラ'], sourceIds: ['readme'], visibility: 'public', verifiedAt,
  },
  {
    id: 'service.avatar', category: 'service', title: '3Dアバターと感情モーション',
    answer: 'VRM形式の3Dアバターを表示し、AI応答の感情に合わせて表情やモーションを切り替えます。',
    aliases: ['アバター機能', 'キャラクターは動く', '感情モーション', 'VRM'],
    keywords: ['アバター', '3D', 'VRM', 'モーション', '感情'], sourceIds: ['readme'], visibility: 'public', verifiedAt,
  },
  {
    id: 'service.chat', category: 'service', title: 'AIチャット',
    answer: 'テキストと画像を使ってAIアンバサダーと会話できます。回答は公開情報を基準とし、確認できない事実は推測しません。',
    aliases: ['チャット機能', 'AIと話せる', '画像を質問', '会話機能'],
    keywords: ['AI', 'チャット', '会話', '画像', '質問'], sourceIds: ['readme', 'runtime-contract'], visibility: 'public', verifiedAt,
  },
  {
    id: 'service.calendar', category: 'service', title: '公開Calendar案内',
    answer: '明確に予定や空き時間を質問した場合だけ、サーバーに設定されたCalendarを確認します。公開指定された予定だけ詳細を案内します。',
    aliases: ['カレンダー機能', '予定を確認', '空き時間', '公開予定'],
    keywords: ['Calendar', 'カレンダー', '予定', '空き時間', '公開'], sourceIds: ['calendar-policy'], visibility: 'public', verifiedAt,
  },
] as const;
