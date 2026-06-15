import { NextRequest, NextResponse } from 'next/server';
import { analyzeRecentMatches } from '../../../lib/evaluationEngine';
import { getPlayerMetadata, getRecentMatches } from '../../../lib/playerService';
import { sortRecentMatchesNewestFirst } from '../../../lib/match-history';
import { MIN_MATCHES_FOR_EVALUATION } from '../../../lib/evaluation-policy';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get('id')?.trim();

  if (!playerId) {
    return NextResponse.json({ message: 'Missing player id' }, { status: 400 });
  }

  const player = await getPlayerMetadata(playerId);
  if (!player) {
    return NextResponse.json({ message: 'Player not found' }, { status: 404 });
  }

  const allMatches = sortRecentMatchesNewestFirst(await getRecentMatches(playerId));
  const matchesForAnalysis = allMatches.slice(0, 5);

  if (allMatches.length < MIN_MATCHES_FOR_EVALUATION) {
    return NextResponse.json(
      {
        playerId,
        name: player.name,
        matchCount: allMatches.length,
        status: 'NOT_ENOUGH_DATA',
        message: `Cần ít nhất ${MIN_MATCHES_FOR_EVALUATION} trận để đánh giá và đưa ra khuyến nghị`,
        recentMatches: allMatches
      },
      { status: 200 }
    );
  }

  const analysis = analyzeRecentMatches(matchesForAnalysis);
  const assessment = analysis.currentFormScore > 8
    ? { status: 'Star Player', action: 'Giữ chặt đội hình chính', color: 'green' as const }
    : analysis.currentFormScore >= 6
      ? { status: 'Stable', action: 'Tiếp tục tin dùng', color: 'white' as const }
      : analysis.currentFormScore >= 4.5
        ? { status: 'Under Review', action: 'Đẩy lên ghế dự bị', color: 'orange' as const }
        : { status: 'Fraud', action: 'Thanh lý ngay lập tức', color: 'red' as const };

  return NextResponse.json(
    {
      playerId,
      name: player.name,
      averageScore: analysis.averageScore,
      currentFormScore: analysis.currentFormScore,
      adjustedAverageScore: analysis.adjustedAverageScore,
      wmaScore: analysis.wmaScore,
      bigWinCountLast5: analysis.bigWinCountLast5,
      bigLossCountLast5: analysis.bigLossCountLast5,
      bigWinRate: analysis.bigWinRate,
      bigLossRate: analysis.bigLossRate,
      matchImpactAvg: analysis.matchImpactAvg,
      matchCount: allMatches.length,
      status: assessment.status,
      action: assessment.action,
      color: assessment.color,
      trendValue: analysis.trendValue,
      trendStatus: analysis.trendStatus,
      variance: analysis.variance,
      stabilityLevel: analysis.stabilityLevel,
      momentum: analysis.momentum,
      momentumStatus: analysis.momentumStatus,
      predictedScore: analysis.predictedScore,
      confidence: analysis.confidence,
      confidenceLevel: analysis.confidenceLevel,
      lossStreak: analysis.lossStreak,
      riskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel,
      fraudRisk: analysis.fraudRisk,
      fraudReasons: analysis.fraudReasons,
      recommendation: analysis.recommendation,
      recommendationReason: analysis.recommendationReason,
      disciplineScore: analysis.disciplineScore,
      aggressionIndex: analysis.aggressionIndex,
      disciplineTrend: analysis.disciplineTrend,
      recentMatches: allMatches
    },
    { status: 200 }
  );
}
