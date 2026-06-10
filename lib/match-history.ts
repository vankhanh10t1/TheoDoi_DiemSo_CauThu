import type { Match, RecentMatch } from './types';

type MatchDateTimeFields = {
  matchDateTime?: string;
  matchDate?: string;
  matchTime?: string;
  createdAt?: string;
};

function parseDateValue(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function parseLocalMatchDateTime(dateValue: unknown, timeValue = '07:00'): number | null {
  if (
    typeof dateValue !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateValue) ||
    !/^\d{2}:\d{2}$/.test(timeValue)
  ) {
    return null;
  }

  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }

  return date.getTime();
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

export function getMatchDateTime(match: MatchDateTimeFields): number {
  return (
    parseDateValue(match.matchDateTime) ??
    parseLocalMatchDateTime(match.matchDate, match.matchTime ?? '07:00') ??
    parseDateValue(match.matchDate) ??
    parseDateValue(match.createdAt) ??
    0
  );
}

export function getMatchChronologyValue(match: RecentMatch): number {
  return getMatchDateTime(match) || parseMatchSortKey(match.sk) || 0;
}

export function sortRecentMatchesNewestFirst(matches: RecentMatch[]): RecentMatch[] {
  return [...matches].sort((left, right) => {
    const dateDifference = getMatchChronologyValue(right) - getMatchChronologyValue(left);
    return dateDifference !== 0
      ? dateDifference
      : String(right.sk ?? '').localeCompare(String(left.sk ?? ''));
  });
}

export function getMatchSortDateTime(
  match: Pick<Match, 'matchDateTime' | 'matchDate' | 'matchTime' | 'createdAt'>
): number {
  return getMatchDateTime(match);
}

export function sortMatchHistoryNewestFirst(matches: Match[]): Match[] {
  return [...matches].sort(
    (left, right) => getMatchSortDateTime(right) - getMatchSortDateTime(left)
  );
}
