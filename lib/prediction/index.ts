import type { PerformanceAnalysis } from '../types';
import { clampScore } from '../analytics';

export interface PredictionInput {
  wmaScore: number;
  recentScore: number;
  trendValue: number;
  variance: number;
  momentum: number;
  lossStreak: number;
  averageScore: number;
  matchCount?: number;
}

export interface PredictionResult {
  predictedScore: number;
  confidence: number;
}

export interface PredictionModel {
  predict(input: PredictionInput): PredictionResult;
}

function clampConfidence(value: number): number {
  return Number(Math.min(1, Math.max(0, value)).toFixed(2));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function getConfidenceLevel(confidence: number): PerformanceAnalysis['confidenceLevel'] {
  if (confidence > 0.8) {
    return 'HIGH';
  }

  if (confidence >= 0.5) {
    return 'MEDIUM';
  }

  return 'LOW';
}

export function createHeuristicPredictionModel(): PredictionModel {
  return {
    predict(input: PredictionInput): PredictionResult {
      const boundedTrendAdjustment = clamp(
        input.trendValue * 0.08 + input.momentum * 0.04,
        -0.35,
        0.35
      );
      const predictedScore = clampScore(
        input.wmaScore * 0.65 +
          input.averageScore * 0.25 +
          input.recentScore * 0.1 +
          boundedTrendAdjustment
      );

      const sampleConfidence =
        typeof input.matchCount === 'number' ? Math.min(0.12, input.matchCount * 0.025) : 0.08;
      const variancePenalty =
        input.variance < 1 ? 0.12 : input.variance <= 4 ? -0.08 : -0.25;
      const confidence = clampConfidence(
        0.5 +
          sampleConfidence +
          variancePenalty +
          (input.lossStreak === 0 ? 0.08 : input.lossStreak === 1 ? 0.02 : -0.08) +
          (Math.abs(input.trendValue) <= 1 ? 0.06 : 0) +
          (Math.abs(input.wmaScore - input.averageScore) <= 0.7 ? 0.06 : -0.04)
      );

      return { predictedScore, confidence };
    }
  };
}

export function predictPlayerScore(
  input: PredictionInput,
  model: PredictionModel = createHeuristicPredictionModel()
): PredictionResult {
  return model.predict(input);
}
