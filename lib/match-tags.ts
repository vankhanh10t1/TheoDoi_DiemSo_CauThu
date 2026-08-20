export const MATCH_TAG_MAX_LENGTH = 80;
export const UNCATEGORIZED_MATCH_TAG = 'Chưa phân loại';
export const COMMON_MATCH_TYPES = ['FRIENDLY', 'LEAGUE', 'CUP', 'RANKED', 'TRAINING'] as const;

export type MatchTagFilters = { season?: string; competition?: string; matchType?: string };

export function normalizeMatchTag(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized || undefined;
}

export function validateMatchTag(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && (normalizeMatchTag(value)?.length ?? 0) <= MATCH_TAG_MAX_LENGTH);
}

export function displayMatchTag(value?: string | null): string {
  return normalizeMatchTag(value) ?? UNCATEGORIZED_MATCH_TAG;
}
