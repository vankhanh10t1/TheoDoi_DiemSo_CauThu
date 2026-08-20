import { describe, expect, it } from 'vitest';
import { createComparisonPlayer } from '../lib/analytics/comparison';
import type { RecentMatch } from '../lib/types';

const match = (score: number, goals = 0): RecentMatch => ({ sk: String(score), score, goals, result: 'Win' });

describe('player comparison analytics', () => {
  it('normalizes count metrics per match and respects the selected window', () => {
    const result = createComparisonPlayer(
      { playerId: 'p1', name: 'A', cardSeason: '24', position: 'ST' },
      [match(8, 2), match(7, 0), match(9, 1), match(6, 0), match(8, 2), match(5, 9)],
      5
    );
    expect(result.matchCount).toBe(5);
    expect(result.metrics.goals).toBe(5);
    expect(result.metrics.goalsPerMatch).toBe(1);
    expect(result.normalized.average).toBeGreaterThanOrEqual(0);
    expect(result.normalized.average).toBeLessThanOrEqual(100);
  });

  it('warns when the sample is weak and tolerates missing optional metrics', () => {
    const result = createComparisonPlayer(
      { playerId: 'p2', name: 'B', cardSeason: '24', position: 'CM' },
      [match(7)],
      5
    );
    expect(result.warning).toBe('Dữ liệu chưa đủ mạnh để kết luận');
    expect(result.metrics.assistsPerMatch).toBe(0);
  });
});
