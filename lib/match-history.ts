import type { Match, RecentMatch } from './types';

type MatchDateTimeFields = {
  matchDateTime?: string;
  matchDate?: string;
  matchTime?: string;
  createdAt?: string;
  updatedAt?: string;
};

const DEFAULT_MATCH_TIME = '07:00';
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const vietnamDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: VIETNAM_TIME_ZONE,
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});
const vietnamDateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: VIETNAM_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});

function createUtcTimestamp(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0
): number | null {
  const timestamp = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const date = new Date(timestamp);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    return null;
  }

  return timestamp;
}

function createVietnamTimestamp(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0
): number | null {
  const vietnamWallClock = createUtcTimestamp(
    year,
    month,
    day,
    hour,
    minute,
    second,
    millisecond
  );

  return vietnamWallClock === null ? null : vietnamWallClock - VIETNAM_OFFSET_MS;
}

function parseDateParts(value: string): [number, number, number] | null {
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    return [Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3])];
  }

  const legacyDate = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (legacyDate) {
    return [Number(legacyDate[3]), Number(legacyDate[2]), Number(legacyDate[1])];
  }

  return null;
}

function parseTimeParts(value: string): [number, number, number, number] | null {
  const time = value.match(/^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
  if (!time) {
    return null;
  }

  const milliseconds = time[4] ? Number(time[4].padEnd(3, '0')) : 0;
  return [Number(time[1]), Number(time[2]), Number(time[3] ?? 0), milliseconds];
}

function parseDateAndTime(dateValue: unknown, timeValue = DEFAULT_MATCH_TIME): number | null {
  if (typeof dateValue !== 'string' || typeof timeValue !== 'string') {
    return null;
  }

  const dateParts = parseDateParts(dateValue.trim());
  const timeParts = parseTimeParts(timeValue.trim());
  if (!dateParts || !timeParts) {
    return null;
  }

  return createVietnamTimestamp(...dateParts, ...timeParts);
}

function parseDateTimeValue(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const normalized = value.trim();
  const compactUtc = normalized.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/
  );
  if (compactUtc) {
    return createUtcTimestamp(
      Number(compactUtc[1]),
      Number(compactUtc[2]),
      Number(compactUtc[3]),
      Number(compactUtc[4]),
      Number(compactUtc[5]),
      Number(compactUtc[6])
    );
  }

  const localDateTime = normalized.match(
    /^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})[T\s](\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)$/
  );
  if (localDateTime) {
    return parseDateAndTime(localDateTime[1], localDateTime[2]);
  }

  const dateOnly = parseDateAndTime(normalized);
  if (dateOnly !== null) {
    return dateOnly;
  }

  // Date.parse is only used for timestamps with an explicit timezone.
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized)) {
    return null;
  }

  const timestamp = Date.parse(normalized);
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

export function getMatchSortTimestamp(match: MatchDateTimeFields): number {
  return (
    parseDateTimeValue(match.matchDateTime) ??
    parseDateAndTime(match.matchDate, match.matchTime ?? DEFAULT_MATCH_TIME) ??
    parseDateTimeValue(match.createdAt) ??
    parseDateTimeValue(match.updatedAt) ??
    0
  );
}

export const getMatchDateTime = getMatchSortTimestamp;

export function formatMatchDateTimeValue(
  match: MatchDateTimeFields,
  fallback = 'Không rõ thời gian'
): string {
  const timestamp = getMatchSortTimestamp(match);
  if (!timestamp) {
    return fallback;
  }

  const parts = Object.fromEntries(
    vietnamDateTimeFormatter
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  return `${parts.hour}:${parts.minute} - ${parts.day}/${parts.month}/${parts.year}`;
}

export function formatMatchDateValue(
  match: MatchDateTimeFields,
  fallback = 'Không rõ ngày'
): string {
  const timestamp = getMatchSortTimestamp(match);
  return timestamp ? vietnamDateFormatter.format(new Date(timestamp)) : fallback;
}

export function getMatchChronologyValue(match: RecentMatch): number {
  return getMatchSortTimestamp(match) || parseMatchSortKey(match.sk) || 0;
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
  match: Pick<Match, 'matchDateTime' | 'matchDate' | 'matchTime' | 'createdAt' | 'updatedAt'>
): number {
  return getMatchSortTimestamp(match);
}

export function sortMatchHistoryNewestFirst(matches: Match[]): Match[] {
  return [...matches].sort(
    (left, right) => getMatchSortDateTime(right) - getMatchSortDateTime(left)
  );
}
