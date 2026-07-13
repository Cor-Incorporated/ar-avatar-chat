import { COMPANY_KNOWLEDGE } from './company.js';
import { DISCLOSURE_KNOWLEDGE } from './disclosure.js';
import { FAQ_KNOWLEDGE } from './faq.js';
import { SERVICE_KNOWLEDGE } from './services.js';

export { KNOWLEDGE_SOURCES } from './sources.js';
export type { KnowledgeCategory, KnowledgeEntry, KnowledgeSearchResult, KnowledgeSource } from './types.js';

export const PUBLIC_KNOWLEDGE = [
  ...COMPANY_KNOWLEDGE,
  ...SERVICE_KNOWLEDGE,
  ...FAQ_KNOWLEDGE,
  ...DISCLOSURE_KNOWLEDGE,
] as const;
