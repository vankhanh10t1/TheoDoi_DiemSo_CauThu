import type { RiskLevel, StabilityLevel, TrendStatus } from '../types';
import { PERFORMANCE_THRESHOLDS, PERFORMANCE_WEIGHTS } from '../analytics/config';

export interface RiskInput {
  trendStatus: TrendStatus;
  stabilityLevel: StabilityLevel;
  lossStreak: number;
  predictedScore: number;
  adjustedWma: number;
  bigWinCountInWindow: number;
  bigLossCountInWindow: number;
  hasBigLossUnderFive: boolean;
}

export interface RiskAnalysis {
  riskScore: number;
  riskLevel: RiskLevel;
}

export function classifyRiskLevel(riskScore: number): RiskLevel {
  if (riskScore >= PERFORMANCE_THRESHOLDS.riskHigh) {
    return 'HIGH';
  }

  if (riskScore >= PERFORMANCE_THRESHOLDS.riskMedium) {
    return 'MEDIUM';
  }

  return 'LOW';
}

function clampRiskScore(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function calculateRiskScore(input: RiskInput): RiskAnalysis {
  const trendRisk = input.trendStatus === 'DOWN' ? 1 : 0;
  const varianceRisk = input.stabilityLevel === 'VOLATILE' ? 1 : input.stabilityLevel === 'UNSTABLE' ? 0.6 : 0;
  const streakRisk = Math.min(1, Math.max(0, input.lossStreak / 3));
  const predictionRisk = input.predictedScore < PERFORMANCE_THRESHOLDS.ratingPoor ? 1 : input.predictedScore < PERFORMANCE_THRESHOLDS.ratingAverage ? 0.5 : 0;

  const weightedRisk = trendRisk * PERFORMANCE_WEIGHTS.riskTrend + varianceRisk * PERFORMANCE_WEIGHTS.riskVariance + streakRisk * PERFORMANCE_WEIGHTS.riskStreak + predictionRisk * PERFORMANCE_WEIGHTS.riskPrediction;
  let riskScore = weightedRisk * 100;

  if (input.bigLossCountInWindow >= 2) {
    riskScore += 15;
  }

  if (input.bigWinCountInWindow >= 2 && input.adjustedWma >= 7) {
    riskScore -= 10;
  }

  if (input.hasBigLossUnderFive) {
    riskScore += 10;
  }

  riskScore = clampRiskScore(riskScore);

  return {
    riskScore: Number(riskScore.toFixed(1)),
    riskLevel: classifyRiskLevel(riskScore)
  };
}

export function isHighVariance(stabilityLevel: StabilityLevel): boolean {
  return stabilityLevel === 'VOLATILE';
}
