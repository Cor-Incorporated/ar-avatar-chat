import type { KnowledgeEntry } from './types.js';

const reviewedAt = '2026-07-11';

export const COMPANY_KNOWLEDGE: readonly KnowledgeEntry[] = [
  {
    id: 'company.identity', category: 'company', title: 'Cor.Inc.について',
    answer: 'Cor.Inc.は福岡発のAI実装会社です。機密データを安全に扱うAI基盤、業務AIの受託開発・導入支援、機密データAI活用診断、Local LLM・セキュアAI／AI基盤PoC、AI見積支援ツール「Grift」を軸に、課題整理から設計・実装・運用まで伴走します。',
    aliases: ['会社について', '会社を紹介して', 'Cor.Inc.とは', 'コアインクとは', 'どんな会社'],
    keywords: ['Cor.Inc', '会社', '機密データAI', '業務AI', 'Local LLM', 'AI基盤', 'Grift'], sourceIds: ['corsweb-ja-copy'], visibility: 'public', reviewedAt,
  },
  {
    id: 'company.ar-demo', category: 'company', title: 'AR技術デモ',
    answer: '名刺マーカー、3Dアバター、AI会話を組み合わせたAR技術デモは、Cor.Inc.の技術実証の一つです。会社全体の事業定義ではありません。',
    aliases: ['ARデモとは', 'このARデモについて'], keywords: ['AR', '名刺マーカー', '3Dアバター', '技術デモ'],
    sourceIds: ['readme', 'project-summary'], visibility: 'public', reviewedAt,
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
