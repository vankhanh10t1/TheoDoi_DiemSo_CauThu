import { describe, expect, it } from 'vitest';
import { createHeuristicPredictionModel, getConfidenceLevel } from '../lib/prediction';
import { calculateRiskScore, classifyRiskLevel } from '../lib/risk';
import { generateRecommendation } from '../lib/recommendation';

describe('prediction and risk engines', () => {
  it('produces a bounded prediction and confidence', () => {
    const prediction = createHeuristicPredictionModel().predict({
      wmaScore: 7.8,
      recentScore: 8,
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

  it('uses normalized base weights and applies variance mainly to confidence', () => {
    const model = createHeuristicPredictionModel();
    const stable = model.predict({
      wmaScore: 8,
      averageScore: 7,
      recentScore: 9,
      trendValue: 0,
      momentum: 0,
      variance: 0.2,
      lossStreak: 0,
      matchCount: 5
    });
    const volatile = model.predict({
      wmaScore: 8,
      averageScore: 7,
      recentScore: 9,
      trendValue: 0,
      momentum: 0,
      variance: 8,
      lossStreak: 0,
      matchCount: 5
    });

    expect(stable.predictedScore).toBe(7.85);
    expect(volatile.predictedScore).toBe(stable.predictedScore);
    expect(volatile.confidence).toBeLessThan(stable.confidence);
  });

  it('derives risk and recommendation from the hybrid signals', () => {
    const risk = calculateRiskScore({
      trendStatus: 'DOWN',
      stabilityLevel: 'VOLATILE',
      lossStreak: 4,
      predictedScore: 3.9,
      adjustedWma: 3.8,
      bigWinCountInWindow: 0,
      bigLossCountInWindow: 2,
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
    expect(recommendation.recommendation).toBe('MONITOR');
    expect(recommendation.reason).toContain('cỡ mẫu nhỏ');
  });

  it('classifies risk exactly at the shared 35 and 70 boundaries', () => {
    expect(classifyRiskLevel(34.99)).toBe('LOW');
    expect(classifyRiskLevel(35)).toBe('MEDIUM');
    expect(classifyRiskLevel(69.99)).toBe('MEDIUM');
    expect(classifyRiskLevel(70)).toBe('HIGH');
  });

  it('classifies confidence exactly at the shared 0.5 and 0.8 boundaries', () => {
    expect(getConfidenceLevel(0.49)).toBe('LOW');
    expect(getConfidenceLevel(0.5)).toBe('MEDIUM');
    expect(getConfidenceLevel(0.79)).toBe('MEDIUM');
    expect(getConfidenceLevel(0.8)).toBe('HIGH');
  });
});
