import { describe, expect, it } from 'vitest';
import { getMatchSortDateTime, sortMatchHistoryNewestFirst } from '../lib/match-history';
import type { Match } from '../lib/types';

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
  it('ưu tiên matchDateTime và fallback sang createdAt khi dữ liệu cũ thiếu ngày trận', () => {
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

  it('sort ngày thi đấu thiếu giờ với mặc định 07:00 và hỗ trợ matchTime tách riêng', () => {
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
});
