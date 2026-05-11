import { NextRequest, NextResponse } from 'next/server';
import { evaluateRecentMatches } from '../../../lib/evaluationEngine';
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

  const recentMatches = await getRecentMatches(playerId, 5);

  if (recentMatches.length < 5) {
    return NextResponse.json(
      {
        playerId,
        name: player.name,
        matchCount: recentMatches.length,
        status: 'Đang theo dõi',
        message: `Cần thêm ít nhất ${5 - recentMatches.length} trận để đánh giá`
      },
      { status: 200 }
    );
  }

  const assessment = evaluateRecentMatches(recentMatches);

  return NextResponse.json(
    {
      playerId,
      name: player.name,
      averageScore: assessment.averageScore,
      matchCount: recentMatches.length,
      status: assessment.status,
      action: assessment.action,
      color: assessment.color,
      recentMatches
    },
    { status: 200 }
  );
}