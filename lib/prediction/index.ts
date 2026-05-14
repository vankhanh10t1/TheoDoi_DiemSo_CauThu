import type { PerformanceAnalysis } from '../types';
import { clampScore } from '../analytics';

export interface PredictionInput {
  wmaScore: number;
  trendValue: number;
  variance: number;
  momentum: number;
  lossStreak: number;
  averageScore: number;
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
      const predictedScore = clampScore(
        input.wmaScore * 0.48 +
          input.averageScore * 0.22 +
          input.trendValue * 0.12 +
          input.momentum * 0.08 -
          input.variance * 0.14 -
          input.lossStreak * 0.25
      );

      const confidence = clampConfidence(
        0.48 +
          (input.lossStreak === 0 ? 0.18 : input.lossStreak === 1 ? 0.06 : -0.08) +
          (input.variance < 1 ? 0.12 : input.variance <= 4 ? -0.02 : -0.12) +
          (Math.abs(input.trendValue) <= 1 ? 0.08 : 0) +
          (Math.abs(input.momentum) <= 1 ? 0.06 : 0) +
          (Math.abs(input.wmaScore - input.averageScore) <= 0.7 ? 0.08 : -0.04)
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
