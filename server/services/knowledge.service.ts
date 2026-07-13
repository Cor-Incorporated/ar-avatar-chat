import { PUBLIC_KNOWLEDGE } from '../knowledge/index.js';
import type { KnowledgeEntry, KnowledgeSearchResult } from '../knowledge/types.js';

export function normalizeKnowledgeText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ja').replace(/[\s、。！？!?・,.\-_/]+/g, '');
}

function scoreEntry(query: string, entry: KnowledgeEntry): KnowledgeSearchResult | null {
  const normalizedQuery = normalizeKnowledgeText(query);
  if (!normalizedQuery) return null;
  let score = 0;
  const matchedTerms: string[] = [];
  const candidates = [entry.title, ...entry.aliases, ...entry.keywords];
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeKnowledgeText(candidate);
    if (!normalizedCandidate) continue;
    if (normalizedQuery === normalizedCandidate) score += 12;
    else if (normalizedQuery.includes(normalizedCandidate)) score += normalizedCandidate.length >= 4 ? 6 : 3;
    else if (normalizedCandidate.includes(normalizedQuery) && normalizedQuery.length >= 3) score += 4;
    else continue;
    matchedTerms.push(candidate);
  }
  return score >= 4 ? { entry, score, matchedTerms } : null;
}

export function searchPublicKnowledge(query: string, limit = 5): KnowledgeSearchResult[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new RangeError('Knowledge search limit must be between 1 and 20');
  if (normalizeKnowledgeText(query).length < 3) return [];
  return PUBLIC_KNOWLEDGE
    .map((entry) => scoreEntry(query, entry))
    .filter((result): result is KnowledgeSearchResult => result !== null)
    .sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id))
    .slice(0, limit);
}
