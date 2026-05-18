import { calculateWMA, calculateTrend, calculateVariance, calculateMomentum, calculateLossStreak, calculateAdjustedScore, calculateMatchImpact } from '../analytics/calculations';
import { calculateDisciplineScore, calculateAggressionIndex, calculateDisciplineTrend } from '../analytics/discipline';
import type { RecentMatch } from '../types';

export type FeatureVector = {
  avg_score: number;
  weighted_average: number;
  variance: number;
  trend: 'UP' | 'STABLE' | 'DOWN';
  discipline_score: number;
  discipline_trend: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
  yellow_rate: number;
  red_rate: number;
  aggression_index: number;
  loss_streak: number;
  momentum: number;
};

export function buildFeatureVector(matches: RecentMatch[]): FeatureVector {
  const recent = matches.slice(0, 5);
  const scores = recent.map((m) => m.score);
  const avg_score = scores.reduce((s, v) => s + v, 0) / Math.max(1, scores.length);
  const adjustedScores = recent.map((m) => calculateAdjustedScore(m.score, calculateMatchImpact(m.result, m.isBigWin, m.isBigLoss)));
  const weighted_average = calculateWMA(adjustedScores);
  const variance = calculateVariance(scores).variance;
  const trend = calculateTrend(adjustedScores).trendStatus;
  const momentum = calculateMomentum(adjustedScores).momentum;
  const loss_streak = calculateLossStreak(matches.slice(0, 3).map((m) => m.result));

  const discipline = calculateDisciplineScore(matches);
  const aggression = calculateAggressionIndex({
    fouls: matches.reduce((s, m) => s + (m.fouls ?? 0), 0),
    yellowCards: matches.reduce((s, m) => s + (m.yellowCards ?? 0), 0),
    redCards: matches.reduce((s, m) => s + (m.redCards ?? 0), 0)
  });

  const totalMatches = Math.max(1, matches.length);
  const yellow_rate = matches.reduce((s, m) => s + (m.yellowCards ?? 0), 0) / totalMatches;
  const red_rate = matches.reduce((s, m) => s + (m.redCards ?? 0), 0) / totalMatches;

  return {
    avg_score,
    weighted_average,
    variance,
    trend,
    discipline_score: discipline.disciplineScore,
    discipline_trend: calculateDisciplineTrend(matches),
    yellow_rate,
    red_rate,
    aggression_index: aggression.aggressionIndex,
    loss_streak,
    momentum
  };
}

export default { buildFeatureVector };
