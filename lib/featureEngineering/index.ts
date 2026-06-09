import { calculateWMA, calculateTrend, calculateVariance, calculateMomentum, calculateLossStreak, calculateAdjustedScore, calculateMatchImpact } from '../analytics/calculations';
import { calculateDisciplineScore, calculateAggressionIndex, calculateDisciplineTrend } from '../analytics/discipline';
import type { RecentMatch } from '../types';
import { sortRecentMatchesNewestFirst } from '../match-history';

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
  const recent = sortRecentMatchesNewestFirst(matches).slice(0, 5);
  const scores = recent.map((m) => m.score);
  const avg_score = scores.reduce((s, v) => s + v, 0) / Math.max(1, scores.length);
  const adjustedScores = recent.map((m) => calculateAdjustedScore(m.score, calculateMatchImpact(m.result, m.isBigWin, m.isBigLoss)));
  const weighted_average = calculateWMA(adjustedScores);
  const variance = calculateVariance(scores).variance;
  const trend = calculateTrend(adjustedScores).trendStatus;
  const momentum = calculateMomentum(adjustedScores).momentum;
  const loss_streak = calculateLossStreak(recent.slice(0, 3).map((m) => m.result));

  const discipline = calculateDisciplineScore(recent);
  const aggression = calculateAggressionIndex({
    fouls: recent.reduce((s, m) => s + (m.fouls ?? 0), 0),
    yellowCards: recent.reduce((s, m) => s + (m.yellowCards ?? 0), 0),
    redCards: recent.reduce((s, m) => s + (m.redCards ?? 0), 0),
    matchCount: recent.length
  });

  const totalMatches = Math.max(1, recent.length);
  const yellow_rate = recent.reduce((s, m) => s + (m.yellowCards ?? 0), 0) / totalMatches;
  const red_rate = recent.reduce((s, m) => s + (m.redCards ?? 0), 0) / totalMatches;

  return {
    avg_score,
    weighted_average,
    variance,
    trend,
    discipline_score: discipline.disciplineScore,
    discipline_trend: calculateDisciplineTrend(recent),
    yellow_rate,
    red_rate,
    aggression_index: aggression.aggressionIndex,
    loss_streak,
    momentum
  };
}

export default { buildFeatureVector };
