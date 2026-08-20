import { describe, expect, it } from 'vitest';
import { analyzeRecentMatches } from '../lib/analytics/performance';
import { calculateEventStats } from '../lib/analytics/events';
import { getParticipationWeight, resolvePositionGroup } from '../lib/analytics/performance-config';
import type { RecentMatch } from '../lib/types';

const match = (score: number, index: number, extra: Partial<RecentMatch> = {}): RecentMatch => ({
  sk: `MATCH#${index}`, matchDate: `2026-08-${String(20 - index).padStart(2, '0')}`,
  score, result: 'Win', minutesPlayed: 90, isStarter: true, ...extra
});

describe('Phase 2 analytics', () => {
  it('supports distinct WMA and decay profiles', () => {
    const matches = [9, 4, 8, 5, 7].map((score, index) => match(score, index));
    const wma = analyzeRecentMatches(matches, { window: 5, weightProfile: 'WMA' });
    const decay = analyzeRecentMatches(matches, { window: 5, weightProfile: 'DECAY' });
    expect(wma.weightProfile).toBe('WMA');
    expect(decay.weightProfile).toBe('DECAY');
    expect(decay.wmaScore).not.toBe(wma.wmaScore);
  });

  it('reduces confidence and weight for short substitute appearances', () => {
    expect(getParticipationWeight(match(8, 1, { minutesPlayed: 18, isStarter: false })))
      .toBeLessThan(getParticipationWeight(match(8, 2, { minutesPlayed: 90, isStarter: true })));
    const short = analyzeRecentMatches([1, 2, 3, 4, 5].map((_, index) => match(8, index, { minutesPlayed: 18, isStarter: false })));
    expect(short.participationConfidence).toBeLessThan(0.5);
    expect(short.recommendationStatus).toBe('INSUFFICIENT');
    expect(short.recommendationReason).toContain('Chưa đủ cơ sở để khuyến nghị');
  });

  it('keeps raw events and never divides by zero', () => {
    const stats = calculateEventStats([match(7, 1, { minutesPlayed: 0, goals: 1, fouls: 2 })]);
    expect(stats.goals.raw).toBe(1);
    expect(stats.goals.per90).toBeNull();
  });

  it('uses all position groups and a safe fallback', () => {
    for (const group of ['GK', 'DF', 'MF', 'FW'] as const) expect(resolvePositionGroup([match(7, 1, { positionGroup: group })])).toBe(group);
    expect(resolvePositionGroup([match(7, 1, { positionGroup: undefined })])).toBe('DEFAULT');
  });

  it('filtered match tags change the analytics sample', () => {
    const matches = [match(9, 1, { season: 'S1', competition: 'Cup', matchType: 'CUP' }), match(4, 2, { season: 'S2', competition: 'League', matchType: 'LEAGUE' })];
    const filtered = matches.filter((item) => item.season === 'S1' && item.competition === 'Cup' && item.matchType === 'CUP');
    expect(analyzeRecentMatches(filtered).averageScore).toBe(9);
    expect(analyzeRecentMatches(matches).averageScore).toBe(6.5);
  });
});
