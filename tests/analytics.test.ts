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
import { classifyAverageScore } from '../lib/analytics/performance';

describe('analytics', () => {
  it('calculates weighted moving average with normalized weights', () => {
    expect(calculateWMA([9, 8, 7])).toBe(8.3);
    expect(calculateWMA([9, 8])).toBe(8.63);
    expect(calculateWMA([7])).toBe(7);
  });

  it('detects trend, variance, and momentum', () => {
    expect(calculateTrend([9, 8, 7])).toEqual({ trendValue: 2, trendStatus: 'UP' });
    expect(calculateVariance([8, 8.2, 7.9])).toEqual({ variance: 0.02, stabilityLevel: 'STABLE' });
    expect(calculateMomentum([9, 8, 7])).toEqual({ momentum: 1, momentumStatus: 'HOT' });
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
    expect(analysis.recommendation).toBe('MONITOR');
    expect(analysis.riskLevel).toBe('HIGH');
    expect(analysis.wmaScore).toBeLessThan(4.5);
  });

  it('classifies rating and variance at their shared boundaries', () => {
    expect(classifyAverageScore(4.44).status).toBe('Needs Monitoring');
    expect(classifyAverageScore(4.5).status).toBe('Under Review');
    expect(classifyAverageScore(6).status).toBe('Stable');
    expect(classifyAverageScore(8).status).toBe('Stable');
    expect(classifyAverageScore(8.1).status).toBe('Star Player');
    expect(calculateVariance([5, 7])).toEqual({ variance: 1, stabilityLevel: 'UNSTABLE' });
    expect(calculateVariance([4, 8])).toEqual({ variance: 4, stabilityLevel: 'UNSTABLE' });
    expect(calculateVariance([3.9, 8.1]).stabilityLevel).toBe('VOLATILE');
  });

  it('supports 5, 10 and 20-match windows and reports the actual sample', () => {
    const matches = Array.from({ length: 15 }, (_, index) => ({ sk: `MATCH#${index}`, score: 7, result: 'Win' as const }));
    expect(analyzeRecentMatches(matches, 5).analyzedMatchCount).toBe(5);
    expect(analyzeRecentMatches(matches, 10).analyzedMatchCount).toBe(10);
    const twenty = analyzeRecentMatches(matches, 20);
    expect(twenty.analysisWindow).toBe(20);
    expect(twenty.analyzedMatchCount).toBe(15);
  });

  it('uses MatchDate ordering before calculating current form', () => {
    const analysis = analyzeRecentMatches([
      { sk: 'MATCH#999', matchDate: '2026-01-01', score: 2, result: 'Loss' },
      { sk: 'MATCH#001', matchDate: '2026-01-03', score: 9, result: 'Win' },
      { sk: 'MATCH#500', matchDate: '2026-01-02', score: 6, result: 'Draw' }
    ]);

    expect(analysis.currentFormScore).toBe(6.76);
    expect(analysis.trendStatus).toBe('UP');
  });

  it('updates the full analysis and explainability for a 10-match window', () => {
    const matches = Array.from({ length: 10 }, (_, index) => ({
      sk: `MATCH#${10 - index}`,
      matchDate: `2026-01-${String(10 - index).padStart(2, '0')}`,
      score: index < 5 ? 9 : 3,
      result: (index < 5 ? 'Win' : 'Loss') as 'Win' | 'Loss'
    }));
    const five = analyzeRecentMatches(matches, 5);
    const ten = analyzeRecentMatches(matches, 10);
    expect(five.analyzedMatchCount).toBe(5);
    expect(ten.analyzedMatchCount).toBe(10);
    expect(ten.wmaScore).not.toBe(five.wmaScore);
    expect(ten.breakdown.length).toBeGreaterThan(0);
    expect(ten.backtest.sampleSize).toBe(7);
  });
});
