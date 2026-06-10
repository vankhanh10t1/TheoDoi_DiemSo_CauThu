import { NextRequest, NextResponse } from 'next/server';
import { analyzeRecentMatches } from '../../../lib/evaluationEngine';
import { getPlayerMetadata, getRecentMatches } from '../../../lib/playerService';

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

  const allMatches = await getRecentMatches(playerId);
  const matchesForAnalysis = allMatches.slice(0, 5);

  if (allMatches.length === 0) {
    return NextResponse.json(
      {
        playerId,
        name: player.name,
        matchCount: 0,
        status: 'Đang theo dõi',
        message: 'Chưa có dữ liệu trận để đánh giá'
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
