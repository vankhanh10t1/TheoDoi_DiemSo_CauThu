import type { RiskLevel, StabilityLevel, TrendStatus } from '../types';

export interface RiskInput {
  trendStatus: TrendStatus;
  stabilityLevel: StabilityLevel;
  lossStreak: number;
  predictedScore: number;
}

export interface RiskAnalysis {
  riskScore: number;
  riskLevel: RiskLevel;
}

function clampRiskLevel(riskScore: number): RiskLevel {
  if (riskScore >= 70) {
    return 'HIGH';
  }

  if (riskScore >= 35) {
    return 'MEDIUM';
  }

  return 'LOW';
}

export function calculateRiskScore(input: RiskInput): RiskAnalysis {
  const trendRisk = input.trendStatus === 'DOWN' ? 1 : 0;
  const varianceRisk = input.stabilityLevel === 'VOLATILE' ? 1 : input.stabilityLevel === 'UNSTABLE' ? 0.6 : 0;
  const streakRisk = Math.min(1, Math.max(0, input.lossStreak / 3));
  const predictionRisk = input.predictedScore < 4.5 ? 1 : input.predictedScore < 6 ? 0.5 : 0;

  const weightedRisk = trendRisk * 0.3 + varianceRisk * 0.25 + streakRisk * 0.25 + predictionRisk * 0.2;
  const riskScore = Number((weightedRisk * 100).toFixed(1));

  return {
    riskScore,
    riskLevel: clampRiskLevel(riskScore)
  };
}

export function isHighVariance(stabilityLevel: StabilityLevel): boolean {
  return stabilityLevel === 'VOLATILE';
}
