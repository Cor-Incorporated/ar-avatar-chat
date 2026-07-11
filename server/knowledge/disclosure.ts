import type { KnowledgeEntry } from './types.js';

export const DISCLOSURE_KNOWLEDGE: readonly KnowledgeEntry[] = [{
  id: 'disclosure.public-only', category: 'disclosure', title: '公開情報のみを回答する',
  answer: '登録済みの公開情報だけを回答し、確認できない事実は推測しません。顧客情報、社内情報、未確定情報は公開しません。',
  aliases: ['情報公開ポリシー', 'プライバシーポリシー', '何を回答できる'],
  keywords: ['公開情報', '推測', '顧客情報', '社内情報', '未確定'],
  sourceIds: ['knowledge-policy'], visibility: 'public', reviewedAt: '2026-07-11',
}] as const;
