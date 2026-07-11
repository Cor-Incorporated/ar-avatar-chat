import type { KnowledgeSource } from './types.js';

export const KNOWLEDGE_SOURCES: readonly KnowledgeSource[] = [
  { id: 'readme', title: 'ARアバターチャット README', repositoryPath: 'README.md', verifiedAt: '2026-07-11' },
  { id: 'project-summary', title: 'ARアバターチャット プロジェクトサマリー', repositoryPath: 'docs/00_プロジェクトサマリー.md', verifiedAt: '2026-07-11' },
  { id: 'calendar-policy', title: '固定Calendar公開ポリシー', repositoryPath: 'README.md#固定google-calendar', verifiedAt: '2026-07-11' },
  { id: 'runtime-contract', title: '現行アプリケーション実装', repositoryPath: 'server/services/gemini.service.ts', verifiedAt: '2026-07-11' },
] as const;
