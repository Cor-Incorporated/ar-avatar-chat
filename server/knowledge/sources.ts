import type { KnowledgeSource } from './types.js';

export const KNOWLEDGE_SOURCES: readonly KnowledgeSource[] = [
  { id: 'readme', title: 'ARアバターチャット README', repositoryPath: 'README.md', sourceUpdatedAt: '2026-07-11', reviewedAt: '2026-07-11', lineHint: 'プロジェクト概要・AI機能' },
  { id: 'project-summary', title: 'ARアバターチャット プロジェクトサマリー', repositoryPath: 'docs/00_プロジェクトサマリー.md', sourceUpdatedAt: '2025-10-01', reviewedAt: '2026-07-11', lineHint: 'ビジネス目標・ターゲットユーザー' },
  { id: 'calendar-policy', title: '固定Calendar公開ポリシー', repositoryPath: 'README.md', sourceUpdatedAt: '2026-07-11', reviewedAt: '2026-07-11', lineHint: '固定Google Calendar・公開規則' },
] as const;
