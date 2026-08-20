export {
  calculateAverageScore,
  calculateLossStreak,
  calculateMomentum,
  calculateTrend,
  calculateVariance,
  calculateWMA,
  clampScore,
  sanitizeScores,
  calculateMatchImpact,
  calculateAdjustedScore,
  normalizeMarginFlags
} from './calculations';

export {
  aggregateBacktestMetrics,
  BACKTEST_MODELS,
  BACKTEST_WINDOWS,
  renderBacktestMarkdown,
  runWalkForwardBacktest
} from './backtest';
