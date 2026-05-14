import type { MatchResult, PerformanceAnalysis, PlayerAssessment, RecentMatch } from '../types';
import {
  calculateAverageScore,
  calculateLossStreak,
  calculateMomentum,
  calculateTrend,
  calculateVariance,
  calculateWMA
} from './calculations';
import { calculateDisciplineScore, calculateAggressionIndex, calculateDisciplineTrend } from './discipline';
import { getConfidenceLevel, predictPlayerScore } from '../prediction';
import { calculateRiskScore } from '../risk';
import { generateRecommendation } from '../recommendation';

function roundToOneDecimal(value: number): number {
  return Number(value.toFixed(1));
}

function toAssessment(score: number): PlayerAssessment {
  const roundedScore = roundToOneDecimal(score);

  if (roundedScore > 8) {
    return {
      averageScore: roundedScore,
      status: 'Star Player',
      action: 'Giữ chặt đội hình chính',
      color: 'green'
    };
  }

  if (roundedScore >= 6) {
    return {
      averageScore: roundedScore,
      status: 'Stable',
      action: 'Tiếp tục tin dùng',
      color: 'white'
    };
  }

  if (roundedScore >= 4.5) {
    return {
      averageScore: roundedScore,
      status: 'Under Review',
      action: 'Đẩy lên ghế dự bị',
      color: 'orange'
    };
  }

  return {
    averageScore: roundedScore,
    status: 'Fraud',
    action: 'Thanh lý ngay lập tức',
    color: 'red'
  };
}

function getRecentResults(matches: RecentMatch[]): MatchResult[] {
  return matches.slice(0, 3).map((match) => match.result);
}

export function analyzeRecentMatches(matches: RecentMatch[]): PerformanceAnalysis {
  const scores = matches.slice(0, 5).map((match) => match.score);
  const recentResults = getRecentResults(matches);
  const averageScore = calculateAverageScore(scores);
  const wmaScore = calculateWMA(scores);
  const trend = calculateTrend(scores);
  const variance = calculateVariance(scores);
  const momentum = calculateMomentum(scores);
  const lossStreak = calculateLossStreak(recentResults);
  const prediction = predictPlayerScore({
    wmaScore,
    trendValue: trend.trendValue,
    variance: variance.variance,
    momentum: momentum.momentum,
    lossStreak,
    averageScore
  });
  const riskAnalysis = calculateRiskScore({
    trendStatus: trend.trendStatus,
    stabilityLevel: variance.stabilityLevel,
    lossStreak,
    predictedScore: prediction.predictedScore
  });
  const fraudReasons: string[] = [];
  // discipline / aggression calculations (if match-level discipline data available)
  const discipline = calculateDisciplineScore(matches);
  const aggression = calculateAggressionIndex({
    fouls: matches.reduce((s, m) => s + (m.fouls ?? 0), 0),
    yellowCards: matches.reduce((s, m) => s + (m.yellowCards ?? 0), 0),
    redCards: matches.reduce((s, m) => s + (m.redCards ?? 0), 0)
  });
  const disciplineTrend = calculateDisciplineTrend(matches);

  const redRate = matches.length ? matches.reduce((s, m) => s + (m.redCards ?? 0), 0) / matches.length : 0;

  let hasFraudRisk =
    prediction.predictedScore < 4.5 &&
    trend.trendStatus === 'DOWN' &&
    variance.stabilityLevel === 'VOLATILE' &&
    lossStreak >= 3;

  if (hasFraudRisk) {
    fraudReasons.push('predictedScore < 4.5');
    fraudReasons.push('trend = DOWN');
    fraudReasons.push('variance = VOLATILE');
    fraudReasons.push('lossStreak >= 3');
  }

  // Extended fraud logic (hybrid): include discipline and red card rate
  const extendedFraud =
    trend.trendStatus === 'DOWN' &&
    variance.stabilityLevel !== 'STABLE' &&
    discipline.disciplineScore < 60 &&
    redRate >= 0.2 &&
    lossStreak >= 3;

  if (extendedFraud) {
    hasFraudRisk = true;
    fraudReasons.push('disciplineScore < 60');
    fraudReasons.push('redRate >= 0.2');
  }

  const recommendation = generateRecommendation({
    wmaScore,
    trendStatus: trend.trendStatus,
    stabilityLevel: variance.stabilityLevel,
    predictedScore: prediction.predictedScore,
    riskAnalysis,
    fraudRisk: hasFraudRisk,
    confidence: prediction.confidence,
    momentumStatus: momentum.momentumStatus
  });

  return {
    averageScore,
    wmaScore,
    trendValue: trend.trendValue,
    trendStatus: trend.trendStatus,
    variance: variance.variance,
    stabilityLevel: variance.stabilityLevel,
    momentum: momentum.momentum,
    momentumStatus: momentum.momentumStatus,
    predictedScore: prediction.predictedScore,
    confidence: prediction.confidence,
    confidenceLevel: getConfidenceLevel(prediction.confidence),
    lossStreak,
    riskScore: riskAnalysis.riskScore,
    riskLevel: riskAnalysis.riskLevel,
    fraudRisk: hasFraudRisk,
    fraudReasons,
    recommendation: recommendation.recommendation,
    recommendationReason: recommendation.reason
    ,
    disciplineScore: discipline.disciplineScore,
    aggressionIndex: aggression.aggressionIndex,
    disciplineTrend
  };
}

export function evaluateRecentMatches(matches: RecentMatch[]): PlayerAssessment {
  if (matches.length === 0) {
    return toAssessment(0);
  }

  return toAssessment(analyzeRecentMatches(matches).wmaScore);
}

export function classifyAverageScore(averageScore: number): PlayerAssessment {
  return toAssessment(averageScore);
}
