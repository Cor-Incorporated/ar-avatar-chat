import type { KnowledgeEntry } from './types.js';

const reviewedAt = '2026-07-11';

export const COMPANY_KNOWLEDGE: readonly KnowledgeEntry[] = [
  {
    id: 'company.identity', category: 'company', title: 'Cor.Inc.について',
    answer: 'Cor.Inc.は、名刺マーカー、3Dアバター、AI会話を組み合わせたAR技術デモを公開しています。',
    aliases: ['会社について', 'Cor.Inc.とは', 'コアインクとは', 'どんな会社'],
    keywords: ['Cor.Inc', '会社', 'AR', '技術デモ'], sourceIds: ['readme', 'project-summary'], visibility: 'public', reviewedAt,
  },
  {
    id: 'company.ambassador', category: 'company', title: 'AIアンバサダー クラウディア',
    answer: 'クラウディアはCor.Inc.のAIアンバサダーで、博多弁を話すキャラクターです。',
    aliases: ['クラウディアとは', 'あなたは誰', 'AIアンバサダー', 'キャラクターの名前'],
    keywords: ['クラウディア', 'キャラクター', 'アンバサダー', '博多弁'], sourceIds: ['readme'], visibility: 'public', reviewedAt,
  },
  {
    id: 'company.demo-purpose', category: 'company', title: 'ARデモの目的',
    answer: 'このデモは、ARやAIに関心のある企業パートナーへ、名刺マーカー、3Dアバター、AI会話を組み合わせた技術体験を紹介するためのものです。',
    aliases: ['このデモの目的', '何のためのアプリ', '誰向けのデモ', '誰向けのアプリ'],
    keywords: ['目的', 'デモ', '企業', 'パートナー', '技術体験'], sourceIds: ['project-summary'], visibility: 'public', reviewedAt,
  },
] as const;
