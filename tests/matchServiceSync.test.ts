import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sqlMock, sqlCalls, transactionCalls } = vi.hoisted(() => {
  const sqlCalls: Array<{ text: string; values: unknown[] }> = [];
  const transactionCalls: Array<{ text: string; values: unknown[] }[]> = [];

  const sqlMock = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('$');
    sqlCalls.push({ text, values });
    return Promise.resolve([]);
  }) as any;

  sqlMock.transaction = vi.fn(async (fn: (tx: any) => Array<{ text: string; values: unknown[] }>) => {
    const txCalls: Array<{ text: string; values: unknown[] }> = [];
    const tx = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = { text: strings.join('$'), values };
      txCalls.push(query);
      return query;
    });

    const queries = fn(tx);
    transactionCalls.push(txCalls);

    return queries.map((query) => {
      if (query.text.includes('delete from match_ratings')) return [{ player_id: 'player-1' }];
      if (query.text.includes('update matches')) return [{ match_id: 'match-1' }];
      return [];
    });
  });

  return { sqlMock, sqlCalls, transactionCalls };
});

vi.mock('../lib/db', () => ({
  sql: sqlMock
}));

import {
  deleteMatch,
  deletePlayerMatchRating,
  resetPlayerMatchHistory,
  saveMatchRatings,
  updateMatch
} from '../lib/matchService';

const matchRow = {
  match_id: 'match-1',
  match_date: '2026-06-01',
  match_time: '07:00',
  match_datetime: '2026-06-01T07:00:00+07:00',
  opponent_name: null,
  my_score: 1,
  opponent_score: 1,
  result: 'DRAW',
  is_big_win: false,
  is_big_loss: false,
  note: null,
  rating_count: 0,
  rating_version: 0,
  created_at: '2026-06-01T00:00:00.000Z',
  updated_at: '2026-06-01T00:00:00.000Z'
};

beforeEach(() => {
  sqlMock.mockReset();
  sqlMock.mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('$');
    sqlCalls.push({ text, values });
    return Promise.resolve([]);
  });
  sqlMock.transaction.mockClear();
  sqlCalls.length = 0;
  transactionCalls.length = 0;
});

describe('match service Postgres synchronization', () => {
  it('upserts ratings and increments match rating_version in one transaction', async () => {
    sqlMock.mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join('$');
      sqlCalls.push({ text, values });
      if (text.includes('from matches m')) return Promise.resolve([matchRow]);
      if (text.includes('from match_ratings')) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    await saveMatchRatings('match-1', {
      ratings: [{ playerId: 'player-1', rating: 8, position: 'ST' }]
    });

    const transaction = transactionCalls[0];
    expect(transaction).toHaveLength(2);
    expect(transaction[0].text).toContain('insert into match_ratings');
    expect(transaction[0].text).toContain('on conflict (match_id, player_id)');
    expect(transaction[1].text).toContain('rating_version = rating_version + 1');
  });

  it('deletes a match from matches and relies on Postgres cascade for ratings', async () => {
    sqlMock.mockImplementationOnce((strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join('$');
      sqlCalls.push({ text, values });
      return Promise.resolve([{ match_id: 'match-1' }]);
    });

    expect(await deleteMatch('match-1')).toBe(true);
    expect(sqlCalls[0].text).toContain('delete from matches');
    expect(sqlCalls[0].text).toContain('returning match_id');
  });

  it('deletes a single rating and increments match rating_version', async () => {
    sqlMock.mockResolvedValueOnce([matchRow]);

    expect(await deletePlayerMatchRating('match-1', 'player-1')).toBe(true);
    const transaction = transactionCalls[0];
    expect(transaction[0].text).toContain('delete from match_ratings');
    expect(transaction[1].text).toContain('update matches');
    expect(transaction[1].text).toContain('rating_version = rating_version + 1');
  });

  it('resets player history by deleting ratings and touching related matches', async () => {
    sqlMock.mockResolvedValueOnce([{ match_id: 'match-1' }]);

    expect(await resetPlayerMatchHistory('player-1')).toBe(1);
    const transaction = transactionCalls[0];
    expect(transaction[0].text).toContain('delete from match_ratings');
    expect(transaction[1].text).toContain('update matches');
  });

  it('updates match score/result and preserves default time fallback', async () => {
    sqlMock.mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join('$');
      sqlCalls.push({ text, values });
      if (text.includes('from matches m')) return Promise.resolve([matchRow]);
      if (text.includes('update matches')) {
        return Promise.resolve([
          {
            ...matchRow,
            match_date: '2026-06-10',
            match_datetime: '2026-06-10T07:00:00+07:00',
            my_score: 4,
            opponent_score: 0,
            result: 'WIN',
            is_big_win: true
          }
        ]);
      }
      return Promise.resolve([]);
    });

    const updated = await updateMatch('match-1', {
      matchDate: '2026-06-10',
      myScore: 4,
      opponentScore: 0
    });

    expect(updated?.result).toBe('WIN');
    expect(updated?.isBigWin).toBe(true);
    expect(updated?.matchDateTime).toBe('2026-06-10T07:00:00+07:00');
  });
});
