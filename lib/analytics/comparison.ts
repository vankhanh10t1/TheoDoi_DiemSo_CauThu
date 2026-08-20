import { analyzeRecentMatches } from './performance';
import type { AnalysisWindow, PlayerSummary, RecentMatch } from '../types';

export const COMPARISON_MIN_MATCHES = 3;

export type ComparisonPlayer = PlayerSummary & {
  matchCount: number;
  warning: string | null;
  metrics: Record<string, number>;
  normalized: Record<string, number>;
};

const round = (value: number) => Number(value.toFixed(2));
const scale10 = (value: number) => Math.max(0, Math.min(100, value * 10));
const scaleSigned = (value: number, range: number) => Math.max(0, Math.min(100, 50 + value * (50 / range)));

export function createComparisonPlayer(player: PlayerSummary, matches: RecentMatch[], window: AnalysisWindow): ComparisonPlayer {
  const used = matches.slice(0, window);
  const analysis = analyzeRecentMatches(used, window);
  const count = used.length;
  const total = (key: 'goals' | 'assists' | 'yellowCards' | 'redCards' | 'fouls') =>
    used.reduce((sum, match) => sum + (match[key] ?? 0), 0);
  const perMatch = (value: number) => count ? round(value / count) : 0;
  const goals = total('goals');
  const assists = total('assists');
  const cards = total('yellowCards') + total('redCards') * 2;
  const fouls = total('fouls');
  const stability = Math.max(0, 100 - analysis.variance * 15);

  return {
    ...player,
    matchCount: count,
    warning: count < COMPARISON_MIN_MATCHES ? 'Dữ liệu chưa đủ mạnh để kết luận' : null,
    metrics: {
      average: round(analysis.averageScore), wma: round(analysis.wmaScore), trend: round(analysis.trendValue),
      variance: round(analysis.variance), momentum: round(analysis.momentum), goals, goalsPerMatch: perMatch(goals),
      assists, assistsPerMatch: perMatch(assists), cardsPerMatch: perMatch(cards), foulsPerMatch: perMatch(fouls),
      discipline: round(analysis.disciplineScore ?? 100), risk: round(analysis.riskScore), prediction: round(analysis.predictedScore)
    },
    normalized: {
      average: scale10(analysis.averageScore), wma: scale10(analysis.wmaScore), trend: scaleSigned(analysis.trendValue, 3),
      stability, momentum: scaleSigned(analysis.momentum, 2), discipline: analysis.disciplineScore ?? 100,
      safety: 100 - analysis.riskScore, prediction: scale10(analysis.predictedScore)
    }
  };
}
