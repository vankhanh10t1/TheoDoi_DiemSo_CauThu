import type { PlayerAssessment, RecentMatch } from './types';
import { evaluateRecentMatches } from './evaluationEngine';

export interface TransferRecommendation {
  playerId: string;
  name: string;
  status: PlayerAssessment['status'];
  averageScore: number;
  matchCount: number;
  recommendation: 'HOLD' | 'SELL' | 'MONITOR';
  reason: string;
  priority: number; // 1-5, higher = more urgent
}

export function generateTransferRecommendation(
  playerId: string,
  name: string,
  recentMatches: RecentMatch[]
): TransferRecommendation | null {
  if (recentMatches.length < 5) {
    return {
      playerId,
      name,
      status: 'Fraud',
      averageScore: 0,
      matchCount: recentMatches.length,
      recommendation: 'MONITOR',
      reason: `Chưa đủ dữ liệu (${recentMatches.length}/5 trận)`,
      priority: 1
    };
  }

  const assessment = evaluateRecentMatches(recentMatches);

  let recommendation: 'HOLD' | 'SELL' | 'MONITOR';
  let reason: string;
  let priority: number;

  switch (assessment.status) {
    case 'Star Player':
      recommendation = 'HOLD';
      reason = `Sao sáng (${assessment.averageScore.toFixed(1)}) - giữ chặt`;
      priority = 1;
      break;

    case 'Stable':
      recommendation = 'HOLD';
      reason = `Ổn định (${assessment.averageScore.toFixed(1)}) - tiếp tục tin dùng`;
      priority = 2;
      break;

    case 'Under Review':
      recommendation = 'MONITOR';
      reason = `Phong độ giảm (${assessment.averageScore.toFixed(1)}) - cần theo dõi kỹ`;
      priority = 3;
      break;

    case 'Fraud':
      recommendation = 'SELL';
      reason = `Phong độ kém (${assessment.averageScore.toFixed(1)}) - nên thanh lý`;
      priority = 5;
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
    priority
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
