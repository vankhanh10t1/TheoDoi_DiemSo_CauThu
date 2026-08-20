import { describe, expect, it } from 'vitest';
import { BACKTEST_MODELS, runWalkForwardBacktest } from '../lib/analytics/backtest';
import { ANONYMOUS_BACKTEST_FIXTURE } from './fixtures/player-backtest';

describe('Phase 3 walk-forward backtest', () => {
  const report = runWalkForwardBacktest(ANONYMOUS_BACKTEST_FIXTURE, { generatedAt: '2026-08-20T00:00:00.000Z' });

  it('evaluates every model on the same samples with stable bounded metrics', () => {
    const overall = report.metrics.filter((metric) => metric.group === 'overall');
    expect(overall.map((metric) => metric.modelName)).toEqual(BACKTEST_MODELS);
    expect(new Set(overall.map((metric) => metric.sampleSize)).size).toBe(1);
    for (const metric of overall) {
      expect(metric.sampleSize).toBe(108);
      expect(metric.mae).toBeGreaterThanOrEqual(0);
      expect(metric.mae).toBeLessThan(2);
      expect(Math.abs(metric.meanError ?? 99)).toBeLessThan(2);
    }
  });

  it('has stable outputs for all four models', () => {
    const firstTarget = report.samples.filter((sample) => sample.playerId === 'anon-gk' && sample.window === 5).slice(0, 4);
    expect(firstTarget.map(({ modelName, predictedRating }) => ({ modelName, predictedRating }))).toEqual([
      { modelName: 'current-heuristic', predictedRating: 6.4 },
      { modelName: 'last-rating', predictedRating: 6.2 },
      { modelName: 'rolling-average', predictedRating: 6.2 },
      { modelName: 'wma-only', predictedRating: 6.22 }
    ]);
  });

  it('never changes an earlier prediction when future ratings change', () => {
    const changed = structuredClone(ANONYMOUS_BACKTEST_FIXTURE);
    changed[0].matches[11].score = 1;
    const changedReport = runWalkForwardBacktest(changed, { generatedAt: report.generatedAt });
    const beforeFuture = (sample: typeof report.samples[number]) => sample.playerId === 'anon-gk' && sample.matchId === 'A-M8';
    expect(changedReport.samples.filter(beforeFuture)).toEqual(report.samples.filter(beforeFuture));
  });

  it('groups metrics by supported dimensions and applies filters before walking forward', () => {
    for (const group of ['position', 'window', 'season', 'competition', 'matchType']) {
      expect(report.metrics.some((metric) => metric.group === group)).toBe(true);
    }
    const cup = runWalkForwardBacktest(ANONYMOUS_BACKTEST_FIXTURE, { windows: [5], filters: { competition: 'Cup' } });
    expect(cup.samples.every((sample) => sample.competition === 'Cup')).toBe(true);
    expect(cup.skipped.length).toBeGreaterThan(0);
  });
});
