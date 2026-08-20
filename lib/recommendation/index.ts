import type { RecommendationAction } from '../types';
import type { RiskAnalysis } from '../risk';
import { isHighVariance } from '../risk';
import { PERFORMANCE_THRESHOLDS } from '../analytics/config';

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
  insufficientReasons?: string[];
}

export interface RecommendationResult {
  recommendation: RecommendationAction;
  reason: string;
  priority: number;
}

export function generateRecommendation(input: RecommendationInput): RecommendationResult {
  if (input.insufficientReasons?.length) {
    return { recommendation: 'MONITOR', reason: `Chưa đủ cơ sở để khuyến nghị: ${input.insufficientReasons.join(' ')}`, priority: 2 };
  }
  if (input.confidence < PERFORMANCE_THRESHOLDS.confidenceMedium) {
    return {
      recommendation: 'MONITOR',
      reason: 'Kết quả chỉ mang tính tham khảo do cỡ mẫu nhỏ; cần theo dõi thêm trước khi đưa ra quyết định',
      priority: 2
    };
  }
  if (input.fraudRisk) {
    return {
      recommendation: 'REPLACE',
      reason: 'Có nhiều tín hiệu phong độ bất thường và rủi ro cao, cần theo dõi thêm',
      priority: 5
    };
  }

  if (input.riskAnalysis.riskLevel === 'HIGH' || input.wmaScore < PERFORMANCE_THRESHOLDS.ratingPoor) {
    return {
      recommendation: 'SELL',
      reason: 'Phong độ hiện tại thấp hoặc rủi ro cao, nên thanh lý',
      priority: 4
    };
  }

  if (typeof input.disciplineScore === 'number' && typeof input.aggressionIndex === 'number') {
    if (
      input.disciplineScore < 50 &&
      input.aggressionIndex >= 3 &&
      input.disciplineTrend === 'DETERIORATING'
    ) {
      return {
        recommendation: 'REPLACE',
        reason: 'Kỷ luật đang xấu đi và mức độ phạm lỗi cao, cần thay thế',
        priority: 5
      };
    }

    if (
      input.disciplineScore < 65 &&
      input.aggressionIndex >= 1.75
    ) {
      return {
        recommendation: 'BENCH',
        reason: 'Kỷ luật kém và mức độ phạm lỗi cao mỗi trận, đưa dự bị để theo dõi',
        priority: 3
      };
    }
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

  if (
    input.riskAnalysis.riskScore >= 30 ||
    input.trendStatus !== 'UP' ||
    input.confidence < PERFORMANCE_THRESHOLDS.confidenceKeep
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
