import type { AnalysisBreakdownItem, AnalysisWindow, MatchResult, PerformanceAnalysis, PlayerAssessment, PositionGroup, PredictionBacktest, RecentMatch, WeightProfile } from '../types';
import {
  calculateAdjustedScore,
  calculateAverageScore,
  calculateBigLossRate,
  calculateBigWinRate,
  calculateLossStreak,
  calculateMatchImpact,
  calculateMomentum,
  calculateTrend,
  calculateVariance,
  calculateWMA,
  calculateWeightedForm
} from './calculations';
import { calculateDisciplineScore, calculateAggressionIndex, calculateDisciplineTrend } from './discipline';
import { getConfidenceLevel, predictPlayerScore } from '../prediction';
import { calculateRiskScore } from '../risk';
import { generateRecommendation } from '../recommendation';
import { sortRecentMatchesNewestFirst } from '../match-history';
import { DEFAULT_ANALYSIS_WINDOW, MIN_BACKTEST_HISTORY, normalizeAnalysisWindow, PERFORMANCE_THRESHOLDS } from './config';
import { calculateEventStats } from './events';
import { DEFAULT_WEIGHT_PROFILE, getParticipationWeight, PARTICIPATION_CONFIG, POSITION_PROFILES, resolvePositionGroup } from './performance-config';

export interface PerformanceAnalysisOptions { window?: number; weightProfile?: WeightProfile; positionGroup?: PositionGroup; }

function roundToOneDecimal(value: number): number {
  return Number(value.toFixed(1));
}

function toAssessment(score: number): PlayerAssessment {
  const roundedScore = roundToOneDecimal(score);

  if (roundedScore > PERFORMANCE_THRESHOLDS.ratingExcellent) {
    return {
      averageScore: roundedScore,
      status: 'Star Player',
      action: 'Giữ chặt đội hình chính',
      color: 'green'
    };
  }

  if (roundedScore >= PERFORMANCE_THRESHOLDS.ratingAverage) {
    return {
      averageScore: roundedScore,
      status: 'Stable',
      action: 'Tiếp tục tin dùng',
      color: 'white'
    };
  }

  if (roundedScore >= PERFORMANCE_THRESHOLDS.ratingPoor) {
    return {
      averageScore: roundedScore,
      status: 'Under Review',
      action: 'Đẩy lên ghế dự bị',
      color: 'orange'
    };
  }

  return {
    averageScore: roundedScore,
    status: 'Needs Monitoring',
    action: 'Cần theo dõi thêm',
    color: 'red'
  };
}

function getRecentResults(matches: RecentMatch[]): MatchResult[] {
  return matches.slice(0, 3).map((match) => match.result);
}

function predictFromHistory(matches: RecentMatch[]) {
  const adjusted = matches.map((match) =>
    calculateAdjustedScore(match.score, calculateMatchImpact(match.result, match.isBigWin, match.isBigLoss))
  );
  const scores = matches.map((match) => match.score);
  const trend = calculateTrend(adjusted);
  const variance = calculateVariance(adjusted);
  const momentum = calculateMomentum(adjusted);
  return predictPlayerScore({
    wmaScore: calculateWMA(adjusted), recentScore: scores[0] ?? 0,
    trendValue: trend.trendValue, variance: variance.variance, momentum: momentum.momentum,
    lossStreak: calculateLossStreak(getRecentResults(matches)),
    averageScore: calculateAverageScore(scores), matchCount: matches.length
  }).predictedScore;
}

export function calculatePredictionBacktest(matches: RecentMatch[], window: AnalysisWindow): PredictionBacktest {
  const chronological = [...sortRecentMatchesNewestFirst(matches)].reverse();
  const items = chronological.slice(MIN_BACKTEST_HISTORY).map((target, index) => {
    const history = chronological.slice(0, index + MIN_BACKTEST_HISTORY).reverse().slice(0, window);
    const predicted = predictFromHistory(history);
    return {
      matchKey: target.sk,
      matchDate: target.matchDateTime ?? target.matchDate ?? target.createdAt,
      predicted,
      actual: target.score,
      error: Number(Math.abs(predicted - target.score).toFixed(2))
    };
  });
  const average = (values: number[]) => values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null;
  return {
    sampleSize: items.length,
    mae: average(items.map((item) => item.error)),
    averagePrediction: average(items.map((item) => item.predicted)),
    averageActual: average(items.map((item) => item.actual)),
    recent: items.slice(-5).reverse()
  };
}

function createBreakdown(input: {
  wma: number; average: number; trend: number; variance: number; momentum: number;
  discipline: number; risk: number; count: number;
}): AnalysisBreakdownItem[] {
  const impact = (value: number, positive: number, negative: number) => value >= positive ? 'POSITIVE' as const : value <= negative ? 'NEGATIVE' as const : 'NEUTRAL' as const;
  return [
    { key: 'wma', label: 'WMA hiện tại', value: input.wma.toFixed(2), meaning: 'Ưu tiên các trận gần nhất trong cửa sổ.', impact: impact(input.wma, 7, 5), contribution: Number(((input.wma - 6) * 0.65).toFixed(2)) },
    { key: 'average', label: 'Rating trung bình', value: input.average.toFixed(2), meaning: 'Mặt bằng rating trong các trận được phân tích.', impact: impact(input.average, 7, 5), contribution: Number(((input.average - 6) * 0.25).toFixed(2)) },
    { key: 'trend', label: 'Xu hướng', value: input.trend.toFixed(2), meaning: input.trend > 1 ? 'Phong độ đang tăng.' : input.trend < -1 ? 'Phong độ đang giảm.' : 'Phong độ tương đối ổn định.', impact: impact(input.trend, 1, -1), contribution: Number((input.trend * 0.08).toFixed(2)) },
    { key: 'variance', label: 'Độ dao động', value: input.variance.toFixed(2), meaning: input.variance > 4 ? 'Dao động cao, kết quả khó ổn định.' : input.variance >= 1 ? 'Có dao động cần theo dõi.' : 'Các rating khá ổn định.', impact: input.variance > 4 ? 'NEGATIVE' : input.variance >= 1 ? 'NEUTRAL' : 'POSITIVE' },
    { key: 'momentum', label: 'Đà phong độ', value: input.momentum.toFixed(2), meaning: input.momentum > .35 ? 'Đà gần đây tích cực.' : input.momentum < -.35 ? 'Đà gần đây suy giảm.' : 'Chưa có thay đổi rõ rệt.', impact: impact(input.momentum, .35, -.35), contribution: Number((input.momentum * .04).toFixed(2)) },
    { key: 'discipline', label: 'Kỷ luật', value: `${input.discipline.toFixed(0)}/100`, meaning: input.discipline < 60 ? 'Thẻ và lỗi đang ảnh hưởng đánh giá.' : 'Mức kỷ luật trong ngưỡng chấp nhận.', impact: input.discipline < 60 ? 'NEGATIVE' : input.discipline >= 80 ? 'POSITIVE' : 'NEUTRAL' },
    { key: 'risk', label: 'Điểm rủi ro', value: `${input.risk.toFixed(1)}/100`, meaning: input.risk >= PERFORMANCE_THRESHOLDS.riskHigh ? 'Rủi ro cao, cần theo dõi thêm.' : input.risk >= PERFORMANCE_THRESHOLDS.riskMedium ? 'Có một số tín hiệu cần chú ý.' : 'Chưa có tín hiệu rủi ro đáng kể.', impact: input.risk >= PERFORMANCE_THRESHOLDS.riskHigh ? 'NEGATIVE' : input.risk >= PERFORMANCE_THRESHOLDS.riskMedium ? 'NEUTRAL' : 'POSITIVE' },
    { key: 'sample', label: 'Cỡ mẫu', value: `${input.count} trận`, meaning: 'Số trận thực tế được dùng để tính.', impact: input.count >= 5 ? 'POSITIVE' : 'NEUTRAL' }
  ];
}

export function analyzeRecentMatches(matches: RecentMatch[], requested: number | PerformanceAnalysisOptions = DEFAULT_ANALYSIS_WINDOW): PerformanceAnalysis {
  const options = typeof requested === 'number' ? { window: requested } : requested;
  const analysisWindow = normalizeAnalysisWindow(options.window);
  const weightProfile = options.weightProfile ?? DEFAULT_WEIGHT_PROFILE;
  const orderedMatches = sortRecentMatchesNewestFirst(matches);
  const recentMatches = orderedMatches.slice(0, analysisWindow);
  const scores = recentMatches.map((match) => match.score);
  const adjustedScores = recentMatches.map((match) =>
    calculateAdjustedScore(match.score, calculateMatchImpact(match.result, match.isBigWin, match.isBigLoss))
  );
  const recentResults = getRecentResults(recentMatches);
  const averageScore = calculateAverageScore(scores);
  const adjustedAverageScore = calculateAverageScore(adjustedScores);
  const wmaScore = calculateWeightedForm(recentMatches, adjustedScores, weightProfile);
  const trend = calculateTrend(adjustedScores);
  const variance = calculateVariance(adjustedScores);
  const momentum = calculateMomentum(adjustedScores);
  const lossStreak = calculateLossStreak(recentResults);
  const bigWinCountInWindow = recentMatches.filter((match) => match.result === 'Win' && match.isBigWin).length;
  const bigLossCountInWindow = recentMatches.filter((match) => match.result === 'Loss' && match.isBigLoss).length;
  const hasBigLossUnderFive = recentMatches.some(
    (match) => match.result === 'Loss' && match.isBigLoss && match.score < 5
  );
  const participationWeights = recentMatches.map(getParticipationWeight);
  const effectiveSampleSize = Number(participationWeights.reduce((sum, value) => sum + value, 0).toFixed(2));
  const participationConfidence = recentMatches.length ? Number((effectiveSampleSize / recentMatches.length).toFixed(2)) : 0;
  const totalMinutes = recentMatches.reduce((sum, match) => sum +
    (typeof match.minutesPlayed === 'number' ? Math.max(0, match.minutesPlayed) : PARTICIPATION_CONFIG.fallbackMinutes), 0);
  const positionGroup = resolvePositionGroup(recentMatches, options.positionGroup);
  const positionProfile = POSITION_PROFILES[positionGroup];
  const prediction = predictPlayerScore({
    wmaScore,
    recentScore: scores[0] ?? averageScore,
    trendValue: trend.trendValue,
    variance: variance.variance,
    momentum: momentum.momentum,
    lossStreak,
    averageScore,
    matchCount: recentMatches.length,
    participationConfidence
  });
  let riskAnalysis = calculateRiskScore({
    trendStatus: trend.trendStatus,
    stabilityLevel: variance.stabilityLevel,
    lossStreak,
    predictedScore: prediction.predictedScore,
    adjustedWma: wmaScore,
    bigWinCountInWindow,
    bigLossCountInWindow,
    hasBigLossUnderFive
  });
  const fraudReasons: string[] = [];
  // discipline / aggression calculations (if match-level discipline data available)
  const discipline = calculateDisciplineScore(recentMatches);
  const aggression = calculateAggressionIndex({
    fouls: recentMatches.reduce((s, m) => s + (m.fouls ?? 0), 0),
    yellowCards: recentMatches.reduce((s, m) => s + (m.yellowCards ?? 0), 0),
    redCards: recentMatches.reduce((s, m) => s + (m.redCards ?? 0), 0),
    matchCount: recentMatches.length
  });
  prediction.predictedScore = Number(Math.max(1, Math.min(10, prediction.predictedScore +
    (Math.max(0, 1 - variance.variance / 10) - 0.5) * positionProfile.stability +
    momentum.momentum * positionProfile.momentum * 0.1)).toFixed(2));
  prediction.confidence = Number(Math.min(prediction.confidence, participationConfidence).toFixed(2));
  const disciplineTrend = calculateDisciplineTrend(recentMatches);

  const redRate = recentMatches.length
    ? recentMatches.reduce((s, m) => s + (m.redCards ?? 0), 0) / recentMatches.length
    : 0;

  let hasFraudRisk =
    prediction.predictedScore < PERFORMANCE_THRESHOLDS.ratingPoor &&
    trend.trendStatus === 'DOWN' &&
    variance.stabilityLevel === 'VOLATILE' &&
    lossStreak >= 3;

  if (hasFraudRisk) {
    fraudReasons.push('Điểm dự đoán dưới 4,5');
    fraudReasons.push('Xu hướng giảm');
    fraudReasons.push('Phong độ dao động cao');
    fraudReasons.push('Chuỗi thua từ 3 trận');
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
    fraudReasons.push('Điểm kỷ luật dưới 60');
    fraudReasons.push('Tỷ lệ thẻ đỏ cao');
  }

  const hybridFraudAlert =
    wmaScore < PERFORMANCE_THRESHOLDS.ratingPoor &&
    trend.trendStatus === 'DOWN' &&
    bigLossCountInWindow >= 2 &&
    variance.stabilityLevel === 'VOLATILE';

  if (hybridFraudAlert) {
    hasFraudRisk = true;
    fraudReasons.push('WMA điều chỉnh dưới 4,5');
    fraudReasons.push('Xu hướng giảm');
    fraudReasons.push('Có ít nhất 2 trận thua đậm');
    fraudReasons.push('Phong độ dao động cao');

    if (riskAnalysis.riskScore < PERFORMANCE_THRESHOLDS.riskHigh) {
      riskAnalysis = {
        ...riskAnalysis,
        riskScore: PERFORMANCE_THRESHOLDS.riskHigh,
        riskLevel: 'HIGH'
      };
    }
  }

  const insufficientReasons = [
    ...(recentMatches.length < 3 ? ['Số trận quá ít.'] : []),
    ...(totalMinutes < PARTICIPATION_CONFIG.minimumRecommendationMinutes ? [`Tổng thời gian thi đấu mới ${totalMinutes} phút.`] : []),
    ...(effectiveSampleSize < PARTICIPATION_CONFIG.minimumEffectiveMatches ? ['Cỡ mẫu hiệu dụng thấp do nhiều trận thi đấu ít phút.'] : []),
    ...(prediction.confidence < PERFORMANCE_THRESHOLDS.confidenceMedium ? ['Độ tin cậy dưới ngưỡng khuyến nghị.'] : [])
  ];
  const recommendation = generateRecommendation({
    wmaScore,
    trendStatus: trend.trendStatus,
    stabilityLevel: variance.stabilityLevel,
    predictedScore: prediction.predictedScore,
    riskAnalysis,
    fraudRisk: hasFraudRisk,
    confidence: prediction.confidence,
    momentumStatus: momentum.momentumStatus,
    disciplineScore: discipline.disciplineScore,
    aggressionIndex: aggression.aggressionIndex,
    disciplineTrend,
    insufficientReasons
  });

  const matchImpacts = recentMatches.map((match) =>
    calculateMatchImpact(match.result, match.isBigWin, match.isBigLoss)
  );
  const matchImpactAvg = matchImpacts.length > 0 ? calculateAverageScore(matchImpacts) : 0;
  const bigWinRate = calculateBigWinRate(bigWinCountInWindow, recentMatches.length);
  const bigLossRate = calculateBigLossRate(bigLossCountInWindow, recentMatches.length);
  const breakdown = createBreakdown({ wma: wmaScore, average: averageScore, trend: trend.trendValue, variance: variance.variance, momentum: momentum.momentum, discipline: discipline.disciplineScore, risk: riskAnalysis.riskScore, count: recentMatches.length });
  breakdown.unshift({ key: 'profile', label: 'Profile trọng số', value: weightProfile === 'DECAY' ? 'Decay' : 'WMA', meaning: `Cửa sổ ${analysisWindow} trận; rating ít phút được giảm trọng số.`, impact: 'NEUTRAL' });
  const backtest = calculatePredictionBacktest(orderedMatches, analysisWindow);
  const lowMinutesWarnings = recentMatches.filter((match) => typeof match.minutesPlayed === 'number' && match.minutesPlayed < PARTICIPATION_CONFIG.lowMinutesThreshold)
    .map((match) => `Rating này có trọng số thấp hơn vì cầu thủ chỉ thi đấu ${match.minutesPlayed} phút.`);
  const eventStats = calculateEventStats(recentMatches);

  return {
    averageScore,
    currentFormScore: wmaScore,
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
    confidenceWarning: insufficientReasons.length ? insufficientReasons.join(' ') : undefined,
    lossStreak,
    riskScore: riskAnalysis.riskScore,
    riskLevel: riskAnalysis.riskLevel,
    fraudRisk: hasFraudRisk,
    fraudReasons,
    recommendation: recommendation.recommendation,
    recommendationReason: recommendation.reason,
    disciplineScore: discipline.disciplineScore,
    aggressionIndex: aggression.aggressionIndex,
    disciplineTrend,
    adjustedAverageScore,
    bigWinCountInWindow,
    bigLossCountInWindow,
    bigWinRate,
    bigLossRate,
    matchImpactAvg,
    analysisWindow,
    analyzedMatchCount: recentMatches.length,
    breakdown,
    backtest,
    weightProfile,
    positionGroup,
    totalMinutes,
    effectiveSampleSize,
    participationConfidence,
    lowMinutesWarnings,
    eventStats,
    recommendationStatus: insufficientReasons.length ? 'INSUFFICIENT' : 'READY',
    recommendationWatchouts: insufficientReasons.length ? insufficientReasons : ['Tiếp tục theo dõi biến động, kỷ luật và thời lượng thi đấu.']
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
