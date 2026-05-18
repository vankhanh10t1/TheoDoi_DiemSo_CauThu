import type { RiskLevel, StabilityLevel, TrendStatus } from '../types';

export interface RiskInput {
  trendStatus: TrendStatus;
  stabilityLevel: StabilityLevel;
  lossStreak: number;
  predictedScore: number;
  adjustedWma: number;
  bigWinCountLast5: number;
  bigLossCountLast5: number;
  hasBigLossUnderFive: boolean;
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

function clampRiskScore(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function calculateRiskScore(input: RiskInput): RiskAnalysis {
  const trendRisk = input.trendStatus === 'DOWN' ? 1 : 0;
  const varianceRisk = input.stabilityLevel === 'VOLATILE' ? 1 : input.stabilityLevel === 'UNSTABLE' ? 0.6 : 0;
  const streakRisk = Math.min(1, Math.max(0, input.lossStreak / 3));
  const predictionRisk = input.predictedScore < 4.5 ? 1 : input.predictedScore < 6 ? 0.5 : 0;

  const weightedRisk = trendRisk * 0.3 + varianceRisk * 0.25 + streakRisk * 0.25 + predictionRisk * 0.2;
  let riskScore = weightedRisk * 100;

  if (input.bigLossCountLast5 >= 2) {
    riskScore += 15;
  }

  if (input.bigWinCountLast5 >= 2 && input.adjustedWma >= 7) {
    riskScore -= 10;
  }

  if (input.hasBigLossUnderFive) {
    riskScore += 10;
  }

  riskScore = clampRiskScore(riskScore);

  return {
    riskScore: Number(riskScore.toFixed(1)),
    riskLevel: clampRiskLevel(riskScore)
  };
}

export function isHighVariance(stabilityLevel: StabilityLevel): boolean {
  return stabilityLevel === 'VOLATILE';
}
