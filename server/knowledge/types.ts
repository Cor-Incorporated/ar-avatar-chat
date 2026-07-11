export type KnowledgeCategory = 'company' | 'service' | 'faq' | 'disclosure';

export interface KnowledgeSource {
  id: string;
  title: string;
  repositoryPath: string;
  verifiedAt: string;
}

export interface KnowledgeEntry {
  id: string;
  category: KnowledgeCategory;
  title: string;
  answer: string;
  aliases: readonly string[];
  keywords: readonly string[];
  sourceIds: readonly string[];
  visibility: 'public';
  verifiedAt: string;
}

export interface KnowledgeSearchResult {
  entry: KnowledgeEntry;
  score: number;
  matchedTerms: readonly string[];
}
