import type { MatchResult, MomentumStatus, StabilityLevel, TrendStatus } from '../types';

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
  const cleanedScores = sanitizeScores(scores).slice(0, 3);

  if (cleanedScores.length === 0) {
    return 0;
  }

  const weights = WMA_WEIGHTS.slice(0, cleanedScores.length);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);

  const weightedSum = cleanedScores.reduce(
    (sum, score, index) => sum + score * weights[index],
    0
  );

  return roundToTwoDecimals(weightedSum / weightTotal);
}

export function calculateTrend(scores: number[]): { trendValue: number; trendStatus: TrendStatus } {
  const cleanedScores = sanitizeScores(scores).slice(0, 3);

  if (cleanedScores.length < 2) {
    return { trendValue: 0, trendStatus: 'STABLE' };
  }

  const trendValue = roundToTwoDecimals(cleanedScores[0] - cleanedScores[cleanedScores.length - 1]);

  if (trendValue > 1) {
    return { trendValue, trendStatus: 'UP' };
  }

  if (trendValue < -1) {
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

  if (roundedVariance < 1) {
    return { variance: roundedVariance, stabilityLevel: 'STABLE' };
  }

  if (roundedVariance <= 4) {
    return { variance: roundedVariance, stabilityLevel: 'UNSTABLE' };
  }

  return { variance: roundedVariance, stabilityLevel: 'VOLATILE' };
}

export function calculateMomentum(scores: number[]): { momentum: number; momentumStatus: MomentumStatus } {
  const cleanedScores = sanitizeScores(scores).slice(0, 3);

  if (cleanedScores.length < 3) {
    return { momentum: 0, momentumStatus: 'NORMAL' };
  }

  const momentum = roundToTwoDecimals(
    (cleanedScores[0] - cleanedScores[1]) + (cleanedScores[1] - cleanedScores[2])
  );

  if (momentum > 1) {
    return { momentum, momentumStatus: 'HOT' };
  }

  if (momentum < -1) {
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
  return roundToTwoDecimals(clamp(value, 0, 10));
}
