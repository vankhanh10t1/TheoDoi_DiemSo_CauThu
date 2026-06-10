import { describe, expect, it } from 'vitest';
import {
  getMatchDateTime,
  getMatchSortDateTime,
  getMatchSortTimestamp,
  formatMatchDateTimeValue,
  formatMatchDateValue,
  sortMatchHistoryNewestFirst,
  sortRecentMatchesNewestFirst
} from '../lib/match-history';
import type { Match, RecentMatch } from '../lib/types';

function makeMatch(id: string, values: Partial<Match>): Match {
  return {
    id,
    matchDate: '',
    myScore: 0,
    opponentScore: 0,
    result: 'DRAW',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...values
  };
}

describe('sortMatchHistoryNewestFirst', () => {
  it('prefers matchDateTime and only falls back to createdAt when match date is missing', () => {
    const matches = [
      makeMatch('entered-later', {
        matchDateTime: '2026-06-09T20:00',
        createdAt: '2026-06-10T23:00:00.000Z'
      }),
      makeMatch('played-later', {
        matchDateTime: '2026-06-10T18:00',
        createdAt: '2026-06-10T19:00:00.000Z'
      }),
      makeMatch('legacy', {
        createdAt: '2026-06-08T12:00:00.000Z'
      })
    ];

    expect(sortMatchHistoryNewestFirst(matches).map((match) => match.id)).toEqual([
      'played-later',
      'entered-later',
      'legacy'
    ]);
  });

  it('uses 07:00 for missing time and supports a separate matchTime', () => {
    const matches = [
      makeMatch('default-0700', { matchDate: '2026-06-10', createdAt: '2026-12-01T00:00:00.000Z' }),
      makeMatch('at-0830', { matchDate: '2026-06-10', matchTime: '08:30' }),
      makeMatch('previous-day', { matchDate: '2026-06-09', matchTime: '23:59' })
    ];

    expect(sortMatchHistoryNewestFirst(matches).map((match) => match.id)).toEqual([
      'at-0830',
      'default-0700',
      'previous-day'
    ]);
    expect(getMatchSortDateTime(matches[0])).not.toBe(Date.parse(matches[0].createdAt));
  });

  it('parses legacy DD/MM/YYYY manually and independently from runtime timezone', () => {
    expect(getMatchSortTimestamp({ matchDateTime: '10/06/2026 09:00' })).toBe(
      Date.UTC(2026, 5, 10, 2, 0)
    );
    expect(getMatchSortTimestamp({ matchDate: '10/06/2026', matchTime: '08:30' })).toBe(
      Date.UTC(2026, 5, 10, 1, 30)
    );
    expect(getMatchSortTimestamp({ matchDate: '10/06/2026' })).toBe(
      Date.UTC(2026, 5, 10, 0, 0)
    );
  });

  it('falls back safely and never uses createdAt when a valid match date exists', () => {
    expect(
      getMatchSortTimestamp({
        matchDateTime: 'invalid',
        matchDate: '09/05/2026',
        matchTime: '20:00',
        createdAt: '2026-12-31T23:59:00.000Z'
      })
    ).toBe(Date.UTC(2026, 4, 9, 13, 0));

    expect(
      getMatchSortTimestamp({
        matchDateTime: 'invalid',
        matchDate: 'invalid',
        createdAt: '2026-06-08T12:00:00.000Z'
      })
    ).toBe(Date.parse('2026-06-08T12:00:00.000Z'));
  });

  it('supports compact timestamps and falls back from createdAt to updatedAt', () => {
    expect(getMatchSortTimestamp({ createdAt: '20260610T120000Z' })).toBe(
      Date.UTC(2026, 5, 10, 12, 0)
    );
    expect(
      getMatchSortTimestamp({
        createdAt: 'invalid',
        updatedAt: '20260611T083000Z'
      })
    ).toBe(Date.UTC(2026, 5, 11, 8, 30));
  });

  it('formats all supported time sources consistently', () => {
    expect(formatMatchDateTimeValue({ matchDateTime: '2026-06-10T09:00' })).toBe(
      '09:00 - 10/06/2026'
    );
    expect(formatMatchDateTimeValue({ matchDate: '10/06/2026' })).toBe(
      '07:00 - 10/06/2026'
    );
    expect(formatMatchDateTimeValue({ createdAt: '20260610T120000Z' })).toBe(
      '19:00 - 10/06/2026'
    );
    expect(formatMatchDateTimeValue({ updatedAt: '20260611T083000Z' })).toBe(
      '15:30 - 11/06/2026'
    );
    expect(formatMatchDateTimeValue({})).toBe('Không rõ thời gian');
  });

  it('converts explicit UTC timestamps to Vietnam time and treats local values as Vietnam time', () => {
    const utcTimestamp = { matchDateTime: '2026-06-10T02:00:00.000Z' };
    const vietnamOffsetTimestamp = { matchDateTime: '2026-06-10T09:00:00+07:00' };
    const legacyLocalTimestamp = { matchDateTime: '2026-06-10T09:00' };

    expect(getMatchSortTimestamp(utcTimestamp)).toBe(Date.parse('2026-06-10T02:00:00.000Z'));
    expect(getMatchSortTimestamp(vietnamOffsetTimestamp)).toBe(
      Date.parse('2026-06-10T02:00:00.000Z')
    );
    expect(getMatchSortTimestamp(legacyLocalTimestamp)).toBe(
      Date.parse('2026-06-10T02:00:00.000Z')
    );
    expect(formatMatchDateTimeValue(utcTimestamp)).toBe('09:00 - 10/06/2026');
    expect(formatMatchDateTimeValue(vietnamOffsetTimestamp)).toBe('09:00 - 10/06/2026');
    expect(formatMatchDateTimeValue(legacyLocalTimestamp)).toBe('09:00 - 10/06/2026');
    expect(formatMatchDateValue(utcTimestamp)).toBe('10/06/2026');
  });

  it('sorts same-day matches by later time first', () => {
    const ratings: RecentMatch[] = [
      { sk: 'MATCH#0830', matchDate: '10/06/2026', matchTime: '08:30', score: 7, result: 'Win' },
      { sk: 'MATCH#0900', matchDateTime: '2026-06-10T09:00', score: 8, result: 'Win' },
      { sk: 'MATCH#older', matchDateTime: '09/05/2026 20:00', score: 6, result: 'Draw' }
    ];

    expect(sortRecentMatchesNewestFirst(ratings).map((match) => match.sk)).toEqual([
      'MATCH#0900',
      'MATCH#0830',
      'MATCH#older'
    ]);
  });

  it('sorts mixed new and old ratings without crashing on invalid values', () => {
    const ratings: RecentMatch[] = [
      { sk: 'MATCH#old', matchDate: '2026-06-09', score: 7, result: 'Win' },
      { sk: 'MATCH#new', matchDateTime: '2026-06-10T10:00:00.000Z', score: 8, result: 'Win' },
      { sk: 'MATCH#fallback', matchDate: 'invalid', createdAt: '2026-06-08T12:00:00.000Z', score: 6, result: 'Draw' }
    ];

    expect(sortRecentMatchesNewestFirst(ratings).map((match) => match.sk)).toEqual([
      'MATCH#new',
      'MATCH#old',
      'MATCH#fallback'
    ]);
    expect(getMatchDateTime({ matchDate: 'invalid', createdAt: 'invalid' })).toBe(0);
  });
});
