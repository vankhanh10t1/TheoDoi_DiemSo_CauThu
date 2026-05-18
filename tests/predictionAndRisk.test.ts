import { describe, expect, it } from 'vitest';
import { createHeuristicPredictionModel } from '../lib/prediction';
import { calculateRiskScore } from '../lib/risk';
import { generateRecommendation } from '../lib/recommendation';

describe('prediction and risk engines', () => {
  it('produces a bounded prediction and confidence', () => {
    const prediction = createHeuristicPredictionModel().predict({
      wmaScore: 7.8,
      trendValue: 1.2,
      variance: 0.8,
      momentum: 1.1,
      lossStreak: 0,
      averageScore: 7.6
    });

    expect(prediction.predictedScore).toBeGreaterThanOrEqual(0);
    expect(prediction.predictedScore).toBeLessThanOrEqual(10);
    expect(prediction.confidence).toBeGreaterThan(0.5);
  });

  it('derives risk and recommendation from the hybrid signals', () => {
    const risk = calculateRiskScore({
      trendStatus: 'DOWN',
      stabilityLevel: 'VOLATILE',
      lossStreak: 4,
      predictedScore: 3.9,
      adjustedWma: 3.8,
      bigWinCountLast5: 0,
      bigLossCountLast5: 2,
      hasBigLossUnderFive: true
    });

    const recommendation = generateRecommendation({
      wmaScore: 3.9,
      trendStatus: 'DOWN',
      stabilityLevel: 'VOLATILE',
      predictedScore: 3.9,
      riskAnalysis: risk,
      fraudRisk: true,
      confidence: 0.42,
      momentumStatus: 'COLD'
    });

    expect(risk.riskLevel).toBe('HIGH');
    expect(recommendation.recommendation).toBe('REPLACE');
  });
});
