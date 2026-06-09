import type { RecentMatch } from './types';

function parseDateValue(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function parseMatchSortKey(sk: unknown): number | null {
  if (typeof sk !== 'string') {
    return null;
  }

  const timestampPart = sk.replace(/^MATCH#/, '');
  const match = timestampPart.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);

  if (!match) {
    return null;
  }

  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6])
  );
}

export function getMatchChronologyValue(match: RecentMatch): number {
  return (
    parseDateValue(match.matchDate) ??
    parseDateValue(match.createdAt) ??
    parseMatchSortKey(match.sk) ??
    0
  );
}

export function sortRecentMatchesNewestFirst(matches: RecentMatch[]): RecentMatch[] {
  return [...matches].sort((left, right) => {
    const dateDifference = getMatchChronologyValue(right) - getMatchChronologyValue(left);
    return dateDifference !== 0
      ? dateDifference
      : String(right.sk ?? '').localeCompare(String(left.sk ?? ''));
  });
}
