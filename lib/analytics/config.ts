import type { AnalysisWindow } from '../types';

export const DEFAULT_ANALYSIS_WINDOW: AnalysisWindow = 5;
export const ANALYSIS_WINDOW_OPTIONS: readonly AnalysisWindow[] = [5, 10, 20];
export const MIN_BACKTEST_HISTORY = 3;

export const PERFORMANCE_THRESHOLDS = {
  ratingExcellent: 8,
  ratingAverage: 6,
  ratingPoor: 4.5,
  trend: 1,
  stableVariance: 1,
  volatileVariance: 4,
  hotMomentum: 0.35,
  riskHigh: 70,
  riskMedium: 35,
  confidenceMedium: 0.5,
  confidenceHigh: 0.8,
  confidenceKeep: 0.6
} as const;

export const PERFORMANCE_WEIGHTS = {
  wmaRecent: [0.5, 0.3, 0.2] as const,
  wmaDecay: 0.6,
  predictionWma: 0.65,
  predictionAverage: 0.25,
  predictionRecent: 0.1,
  trendAdjustment: 0.08,
  momentumAdjustment: 0.04,
  riskTrend: 0.3,
  riskVariance: 0.25,
  riskStreak: 0.25,
  riskPrediction: 0.2
} as const;

export function getSampleConfidence(matchCount: number): number {
  if (matchCount < 5) return 0.4;
  if (matchCount < 10) return 0.65;
  return 0.85;
}

export function normalizeAnalysisWindow(value?: number): AnalysisWindow {
  return value === 10 || value === 20 ? value : DEFAULT_ANALYSIS_WINDOW;
}
