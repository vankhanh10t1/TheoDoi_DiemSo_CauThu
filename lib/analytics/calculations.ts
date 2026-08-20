import type { MatchResult, MomentumStatus, StabilityLevel, TrendStatus } from '../types';
import { PERFORMANCE_THRESHOLDS } from './config';

const WMA_WEIGHTS = [0.5, 0.3, 0.2];

function roundToTwoDecimals(value: number): number {
  return Number(value.toFixed(2));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function sanitizeScores(scores: number[]): number[] {
  return scores.filter((score) => Number.isFinite(score));
}

export function calculateAverageScore(scores: number[]): number {
  const cleanedScores = sanitizeScores(scores);

  if (cleanedScores.length === 0) {
    return 0;
  }

  return roundToTwoDecimals(
    cleanedScores.reduce((sum, score) => sum + score, 0) / cleanedScores.length
  );
}

export function calculateWMA(scores: number[]): number {
  const cleanedScores = sanitizeScores(scores);

  if (cleanedScores.length === 0) {
    return 0;
  }

  const weights = cleanedScores.map((_, index) =>
    WMA_WEIGHTS[index] ?? WMA_WEIGHTS[WMA_WEIGHTS.length - 1] * 0.6 ** (index - 2)
  );
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);

  const weightedSum = cleanedScores.reduce(
    (sum, score, index) => sum + score * weights[index],
    0
  );

  return roundToTwoDecimals(weightedSum / weightTotal);
}

export function calculateTrend(scores: number[]): { trendValue: number; trendStatus: TrendStatus } {
  const cleanedScores = sanitizeScores(scores);

  if (cleanedScores.length < 2) {
    return { trendValue: 0, trendStatus: 'STABLE' };
  }

  const trendValue = roundToTwoDecimals(cleanedScores[0] - cleanedScores[cleanedScores.length - 1]);

  if (trendValue > PERFORMANCE_THRESHOLDS.trend) {
    return { trendValue, trendStatus: 'UP' };
  }

  if (trendValue < -PERFORMANCE_THRESHOLDS.trend) {
    return { trendValue, trendStatus: 'DOWN' };
  }

  return { trendValue, trendStatus: 'STABLE' };
}

export function calculateVariance(scores: number[]): { variance: number; stabilityLevel: StabilityLevel } {
  const cleanedScores = sanitizeScores(scores);

  if (cleanedScores.length === 0) {
    return { variance: 0, stabilityLevel: 'STABLE' };
  }

  const average = cleanedScores.reduce((sum, score) => sum + score, 0) / cleanedScores.length;
  const variance = cleanedScores.reduce((sum, score) => sum + (score - average) ** 2, 0) / cleanedScores.length;
  const roundedVariance = roundToTwoDecimals(variance);

  if (roundedVariance < PERFORMANCE_THRESHOLDS.stableVariance) {
    return { variance: roundedVariance, stabilityLevel: 'STABLE' };
  }

  if (roundedVariance <= PERFORMANCE_THRESHOLDS.volatileVariance) {
    return { variance: roundedVariance, stabilityLevel: 'UNSTABLE' };
  }

  return { variance: roundedVariance, stabilityLevel: 'VOLATILE' };
}

export function calculateMomentum(scores: number[]): { momentum: number; momentumStatus: MomentumStatus } {
  const cleanedScores = sanitizeScores(scores);

  if (cleanedScores.length < 2) {
    return { momentum: 0, momentumStatus: 'NORMAL' };
  }

  const chronologicalScores = [...cleanedScores].reverse();
  const count = chronologicalScores.length;
  const xAverage = (count - 1) / 2;
  const yAverage = chronologicalScores.reduce((sum, score) => sum + score, 0) / count;
  const numerator = chronologicalScores.reduce(
    (sum, score, index) => sum + (index - xAverage) * (score - yAverage),
    0
  );
  const denominator = chronologicalScores.reduce(
    (sum, _score, index) => sum + (index - xAverage) ** 2,
    0
  );
  const momentum = roundToTwoDecimals(denominator === 0 ? 0 : numerator / denominator);

  if (momentum > PERFORMANCE_THRESHOLDS.hotMomentum) {
    return { momentum, momentumStatus: 'HOT' };
  }

  if (momentum < -PERFORMANCE_THRESHOLDS.hotMomentum) {
    return { momentum, momentumStatus: 'COLD' };
  }

  return { momentum, momentumStatus: 'NORMAL' };
}

export function calculateLossStreak(results: MatchResult[]): number {
  let streak = 0;

  for (const result of results) {
    if (result !== 'Loss') {
      break;
    }

    streak += 1;
  }

  return streak;
}

export function clampScore(value: number): number {
  return roundToTwoDecimals(clamp(value, 1, 10));
}

export function normalizeMarginFlags(result: MatchResult, isBigWin?: boolean, isBigLoss?: boolean) {
  if (result === 'Win') {
    return {
      isBigWin: Boolean(isBigWin),
      isBigLoss: false
    };
  }

  if (result === 'Loss') {
    return {
      isBigWin: false,
      isBigLoss: Boolean(isBigLoss)
    };
  }

  return {
    isBigWin: false,
    isBigLoss: false
  };
}

export function calculateMatchImpact(result: MatchResult, isBigWin?: boolean, isBigLoss?: boolean): number {
  if (result === 'Win') {
    return isBigWin ? 0.4 : 0.2;
  }
  if (result === 'Loss') {
    return isBigLoss ? -0.5 : -0.2;
  }
  return 0; // Draw
}

export function calculateAdjustedScore(rawScore: number, matchImpact: number): number {
  const adjusted = rawScore + matchImpact;
  return roundToTwoDecimals(clamp(adjusted, 1, 10));
}

export function calculateBigWinRate(bigWinCount: number, matchCount: number): number {
  if (matchCount === 0) {
    return 0;
  }
  return roundToTwoDecimals(bigWinCount / matchCount);
}

export function calculateBigLossRate(bigLossCount: number, matchCount: number): number {
  if (matchCount === 0) {
    return 0;
  }
  return roundToTwoDecimals(bigLossCount / matchCount);
}
