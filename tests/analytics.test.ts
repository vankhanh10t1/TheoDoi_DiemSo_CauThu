import { describe, expect, it } from 'vitest';
import {
  calculateMomentum,
  calculateTrend,
  calculateVariance,
  calculateWMA,
  calculateMatchImpact,
  calculateAdjustedScore
} from '../lib/analytics';
import { analyzeRecentMatches } from '../lib/analytics/performance';

describe('analytics', () => {
  it('calculates weighted moving average with normalized weights', () => {
    expect(calculateWMA([9, 8, 7])).toBe(8.3);
    expect(calculateWMA([9, 8])).toBe(8.63);
    expect(calculateWMA([7])).toBe(7);
  });

  it('detects trend, variance, and momentum', () => {
    expect(calculateTrend([9, 8, 7])).toEqual({ trendValue: 2, trendStatus: 'UP' });
    expect(calculateVariance([8, 8.2, 7.9])).toEqual({ variance: 0.02, stabilityLevel: 'STABLE' });
    expect(calculateMomentum([9, 8, 7])).toEqual({ momentum: 2, momentumStatus: 'HOT' });
  });

  it('supports match impact and adjusted score calculations', () => {
    expect(calculateMatchImpact('Win', true, false)).toBe(0.4);
    expect(calculateMatchImpact('Win', false, false)).toBe(0.2);
    expect(calculateMatchImpact('Loss', false, true)).toBe(-0.5);
    expect(calculateMatchImpact('Loss', false, false)).toBe(-0.2);
    expect(calculateMatchImpact('Draw', false, false)).toBe(0);
    expect(calculateAdjustedScore(6.0, 0.4)).toBe(6.4);
    expect(calculateAdjustedScore(9.8, 0.4)).toBe(10);
    expect(calculateAdjustedScore(1.2, -0.5)).toBe(1);
  });

  it('analyzes recent matches into a richer performance report', () => {
    const analysis = analyzeRecentMatches([
      { sk: 'MATCH#3', score: 1, result: 'Loss' },
      { sk: 'MATCH#2', score: 3, result: 'Loss' },
      { sk: 'MATCH#1', score: 9, result: 'Loss' }
    ]);

    expect(analysis.fraudRisk).toBe(true);
    expect(analysis.recommendation).toBe('REPLACE');
    expect(analysis.riskLevel).toBe('HIGH');
    expect(analysis.wmaScore).toBeLessThan(4.5);
  });
});
