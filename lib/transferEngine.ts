import type { PlayerAssessment, RecentMatch } from './types';
import { evaluateRecentMatches } from './evaluationEngine';

export type PerformanceTrend = 'UP' | 'DOWN' | 'STABLE';

export interface TransferRecommendation {
  playerId: string;
  name: string;
  status: PlayerAssessment['status'];
  averageScore: number;
  matchCount: number;
  recommendation: 'HOLD' | 'SELL' | 'MONITOR';
  reason: string;
  priority: number; // 1-5, higher = more urgent
  trend: PerformanceTrend;
  trendValue: number; // x3 - x1
}

/**
 * Calculate performance trend based on last 3 matches (or all matches if less than 3)
 * Formula: trend = x3 - x1, where x3 = newest, x1 = oldest
 * @returns { trend: 'UP' | 'DOWN' | 'STABLE', value: number }
 */
export function calculatePerformanceTrend(recentMatches: RecentMatch[]): {
  trend: PerformanceTrend;
  value: number;
} {
  if (recentMatches.length === 0) {
    return { trend: 'STABLE', value: 0 };
  }

  // Use up to 3 recent matches, reversed so oldest is first
  const matchesToAnalyze = recentMatches.slice(0, 3).reverse();

  if (matchesToAnalyze.length === 1) {
    // Only one match, no trend
    return { trend: 'STABLE', value: 0 };
  }

  const x1 = matchesToAnalyze[0].score; // oldest of the analyzed matches
  const x3 = matchesToAnalyze[matchesToAnalyze.length - 1].score; // newest of the analyzed matches

  const trendValue = x3 - x1;

  let trend: PerformanceTrend = 'STABLE';
  if (trendValue > 1) {
    trend = 'UP';
  } else if (trendValue < -1) {
    trend = 'DOWN';
  }

  return { trend, value: trendValue };
}

export function generateTransferRecommendation(
  playerId: string,
  name: string,
  recentMatches: RecentMatch[]
): TransferRecommendation | null {
  if (recentMatches.length === 0) {
    return null;
  }

  const assessment = evaluateRecentMatches(recentMatches);
  const { trend, value: trendValue } = calculatePerformanceTrend(recentMatches);

  let recommendation: 'HOLD' | 'SELL' | 'MONITOR';
  let reason: string;
  let priority: number;

  switch (assessment.status) {
    case 'Star Player':
      recommendation = 'HOLD';
      const starNote = trend === 'DOWN' ? ' (⚠️ giảm)' : trend === 'UP' ? ' (📈 tăng)' : '';
      reason = `Sao sáng (${assessment.averageScore.toFixed(1)}) - giữ chặt (${recentMatches.length} trận)${starNote}`;
      priority = trend === 'DOWN' ? 2 : 1;
      break;

    case 'Stable':
      recommendation = 'HOLD';
      const stableNote = trend === 'DOWN' ? ' (⚠️ có xu hướng giảm)' : trend === 'UP' ? ' (📈 có xu hướng tăng)' : '';
      reason = `Ổn định (${assessment.averageScore.toFixed(1)}) - tiếp tục tin dùng (${recentMatches.length} trận)${stableNote}`;
      priority = trend === 'DOWN' ? 2 : 1;
      break;

    case 'Under Review':
      // If trend is UP, maybe it's recovering - MONITOR with lower priority
      // If trend is DOWN, getting worse - MONITOR with higher priority
      recommendation = 'MONITOR';
      const reviewNote = trend === 'DOWN' ? ' (⬇️ tiếp tục giảm)' : trend === 'UP' ? ' (📈 đang phục hồi)' : '';
      reason = `Phong độ giảm (${assessment.averageScore.toFixed(1)}) - cần theo dõi kỹ (${recentMatches.length} trận)${reviewNote}`;
      priority = trend === 'DOWN' ? 4 : 3;
      break;

    case 'Fraud':
      // If trend is UP, maybe recovering - MONITOR instead of immediate SELL
      // If trend is DOWN, getting worse - SELL with highest priority
      if (trend === 'UP') {
        recommendation = 'MONITOR';
        reason = `Phong độ kém (${assessment.averageScore.toFixed(1)}) - đang phục hồi nhưng theo dõi (${recentMatches.length} trận)`;
        priority = 4;
      } else {
        recommendation = 'SELL';
        const fraudNote = trend === 'DOWN' ? ' (⬇️ tiếp tục giảm)' : '';
        reason = `Phong độ kém (${assessment.averageScore.toFixed(1)}) - nên thanh lý (${recentMatches.length} trận)${fraudNote}`;
        priority = 5;
      }
      break;

    default:
      recommendation = 'MONITOR';
      reason = 'Đang theo dõi';
      priority = 2;
  }

  return {
    playerId,
    name,
    status: assessment.status,
    averageScore: assessment.averageScore,
    matchCount: recentMatches.length,
    recommendation,
    reason,
    priority,
    trend,
    trendValue
  };
}

export function rankTransferRecommendations(
  recommendations: TransferRecommendation[]
): TransferRecommendation[] {
  return [...recommendations].sort((a, b) => {
    // Prioritize SELL, then MONITOR, then HOLD
    const priorityOrder = { SELL: 0, MONITOR: 1, HOLD: 2 };
    const aOrder = priorityOrder[a.recommendation];
    const bOrder = priorityOrder[b.recommendation];

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    // Within same recommendation, sort by priority descending (higher = more urgent)
    return b.priority - a.priority;
  });
}
