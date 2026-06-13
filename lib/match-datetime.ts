const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const vietnamDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: VIETNAM_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export function getVietnamDateInputValue(date = new Date()): string {
  const parts = Object.fromEntries(
    vietnamDateFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function createSubmitMatchDateTime(date = new Date()): string {
  return date.toISOString();
}

export function isValidMatchDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isValidMatchDateTime(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;

  const dateTimeMatch = value.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/
  );
  if (!dateTimeMatch) return false;

  const [, date, hourValue, minuteValue, secondValue] = dateTimeMatch;
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const second = secondValue === undefined ? 0 : Number(secondValue);
  const timestamp = Date.parse(value);
  return (
    isValidMatchDate(date) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 59 &&
    Number.isFinite(timestamp)
  );
}

// Legacy/backfill helper only. New matches must use createSubmitMatchDateTime().
export function createMatchDateTime(matchDate: string, matchTime = '07:00'): string {
  if (!isValidMatchDate(matchDate) || !/^\d{2}:\d{2}$/.test(matchTime)) {
    throw new Error('Invalid match date or time');
  }

  const matchDateTime = `${matchDate}T${matchTime}:00+07:00`;
  if (!isValidMatchDateTime(matchDateTime)) {
    throw new Error('Invalid match date or time');
  }

  return matchDateTime;
}
