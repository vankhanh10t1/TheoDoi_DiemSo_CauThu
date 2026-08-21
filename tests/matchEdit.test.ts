import { describe, expect, it } from 'vitest';
import { buildMatchPatch } from '../lib/match-edit';
import type { Match } from '../lib/types';

const match: Match = {
  id: 'match-1', matchDate: '2026-06-10', matchDateTime: '2026-06-10T09:15:00+07:00',
  matchTime: '09:15:00', myScore: 1, opponentScore: 0, result: 'WIN',
  isBigWin: false, isBigLoss: false, opponentName: 'FC A', ratingVersion: 0,
  createdAt: '2026-06-10T00:00:00Z', updatedAt: '2026-06-10T00:00:00Z'
};

function form(overrides: Record<string, string> = {}) {
  const values = { matchDate: '2026-06-10', opponentName: 'FC A', myScore: '1', opponentScore: '0', note: '', season: '', competition: '', matchType: '', ...overrides };
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe('match edit partial payload', () => {
  it('omits unchanged date/time when adding season and competition', () => {
    expect(buildMatchPatch(match, form({ season: ' 2026-S1 ', competition: ' Cup nội bộ ' }))).toEqual({ season: '2026-S1', competition: 'Cup nội bộ' });
  });

  it('updates metadata without sending date/time', () => {
    const patch = buildMatchPatch(match, form({ matchType: 'CUP', opponentName: 'FC B', myScore: '2' }));
    expect(patch).toEqual({ opponentName: 'FC B', matchType: 'CUP', myScore: 2 });
    expect(patch).not.toHaveProperty('matchDate');
  });

  it('includes the date only when it changes', () => {
    expect(buildMatchPatch(match, form({ matchDate: '2026-06-11' }))).toEqual({ matchDate: '2026-06-11' });
  });
});
