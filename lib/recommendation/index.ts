import type { RecommendationAction } from '../types';
import type { RiskAnalysis } from '../risk';
import { isHighVariance } from '../risk';

export interface RecommendationInput {
  wmaScore: number;
  trendStatus: 'UP' | 'STABLE' | 'DOWN';
  stabilityLevel: 'STABLE' | 'UNSTABLE' | 'VOLATILE';
  predictedScore: number;
  riskAnalysis: RiskAnalysis;
  fraudRisk: boolean;
  confidence: number;
  momentumStatus: 'HOT' | 'NORMAL' | 'COLD';
  disciplineScore?: number;
  aggressionIndex?: number;
  disciplineTrend?: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
}

export interface RecommendationResult {
  recommendation: RecommendationAction;
  reason: string;
  priority: number;
}

export function generateRecommendation(input: RecommendationInput): RecommendationResult {
  if (input.fraudRisk) {
    return {
      recommendation: 'REPLACE',
      reason: 'Cảnh báo gian lận/rủi ro cao, cần thay thế ngay',
      priority: 5
    };
  }

  if (input.riskAnalysis.riskLevel === 'HIGH' || input.predictedScore < 4) {
    return {
      recommendation: 'SELL',
      reason: 'Điểm dự đoán thấp và rủi ro cao, nên thanh lý',
      priority: 4
    };
  }

  if (
    input.riskAnalysis.riskScore >= 55 ||
    isHighVariance(input.stabilityLevel) ||
    input.trendStatus === 'DOWN' ||
    input.momentumStatus === 'COLD'
  ) {
    return {
      recommendation: 'BENCH',
      reason: 'Phong độ thiếu ổn định, nên cho dự bị để theo dõi',
      priority: 3
    };
  }

  // Use discipline/aggression signals: aggressive + poor discipline => higher priority bench or replace
  if (typeof input.disciplineScore === 'number' && typeof input.aggressionIndex === 'number') {
    if (input.disciplineScore < 50 && input.aggressionIndex >= 8) {
      return {
        recommendation: 'REPLACE',
        reason: 'Vấn đề kỷ luật nghiêm trọng và hành vi hung hãn, cần thay thế',
        priority: 5
      };
    }

    if (input.disciplineScore < 65 && input.aggressionIndex >= 5) {
      return {
        recommendation: 'BENCH',
        reason: 'Kỷ luật kém và mức độ hung hãn trung bình, đưa dự bị để theo dõi',
        priority: 3
      };
    }
  }

  if (
    input.riskAnalysis.riskScore >= 30 ||
    input.trendStatus !== 'UP' ||
    input.confidence < 0.6
  ) {
    return {
      recommendation: 'MONITOR',
      reason: 'Cần theo dõi thêm trước khi chốt quyết định',
      priority: 2
    };
  }

  return {
    recommendation: 'KEEP',
    reason: 'Phong độ tốt, tiếp tục giữ trong đội hình',
    priority: 1
  };
}

export function recommendationRank(recommendation: RecommendationAction): number {
  const order: Record<RecommendationAction, number> = {
    REPLACE: 0,
    SELL: 1,
    BENCH: 2,
    MONITOR: 3,
    KEEP: 4
  };

  return order[recommendation];
}
