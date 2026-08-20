import type { PlayerAssessment, RecentMatch } from './types';
import type { PerformanceAnalysisOptions } from './analytics/performance';
import {
  analyzeRecentMatches as analyzeRecentMatchesCore,
  classifyAverageScore as classifyAverageScoreCore,
  evaluateRecentMatches as evaluateRecentMatchesCore
} from './analytics/performance';

export function roundToOneDecimal(value: number): number {
  return Number(value.toFixed(1));
}

export function classifyAverageScore(averageScore: number): PlayerAssessment {
  return classifyAverageScoreCore(averageScore);
}

export function evaluateRecentMatches(matches: RecentMatch[]): PlayerAssessment {
  return evaluateRecentMatchesCore(matches);
}

export function analyzeRecentMatches(matches: RecentMatch[], options?: number | PerformanceAnalysisOptions) {
  return analyzeRecentMatchesCore(matches, options);
}
