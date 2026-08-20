import type { AnalysisWindow } from '../types';

export const DEFAULT_ANALYSIS_WINDOW: AnalysisWindow = 5;
export const ANALYSIS_WINDOW_OPTIONS: readonly AnalysisWindow[] = [5, 10, 20];
export const MIN_BACKTEST_HISTORY = 3;

export const PERFORMANCE_THRESHOLDS = {
  star: 8,
  stable: 6,
  review: 4.5,
  trend: 1,
  stableVariance: 1,
  volatileVariance: 4,
  hotMomentum: 0.35,
  highRisk: 70,
  mediumRisk: 35
} as const;

export function normalizeAnalysisWindow(value?: number): AnalysisWindow {
  return value === 10 || value === 20 ? value : DEFAULT_ANALYSIS_WINDOW;
}
