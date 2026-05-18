import { NextRequest, NextResponse } from 'next/server';
import { debugListMatchRatings, getMatchById } from '../../../lib/matchService';

/**
 * GET /api/debug-ratings?matchId=<matchId>
 * Debug endpoint to verify the fix for Match 2 overwrite bug
 * Shows both match-centric and player-centric rating records
 */
export async function GET(request: NextRequest) {
  try {
    const matchId = request.nextUrl.searchParams.get('matchId');

    if (!matchId) {
      return NextResponse.json(
        {
          error: 'matchId query parameter is required',
          code: 'MISSING_MATCH_ID',
          usage: 'GET /api/debug-ratings?matchId=match_YYYYMMDDTHHMMSSZ'
        },
        { status: 400 }
      );
    }

    // Verify match exists
    const match = await getMatchById(matchId);
    if (!match) {
      return NextResponse.json(
        {
          error: `Match ${matchId} not found`,
          code: 'MATCH_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    const result = await debugListMatchRatings(matchId);

    if (!result) {
      return NextResponse.json(
        {
          error: 'Failed to debug ratings',
          code: 'DEBUG_ERROR'
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        matchId,
        match,
        analysis: {
          matchCentricRatings: result.matchRatings.length,
          playerCentricRatings: result.playerCentricRatings.length,
          isConsistent: result.matchRatings.length === result.playerCentricRatings.length,
          description: 'If isConsistent is true, each match has unique player-centric records (bug is fixed)'
        },
        matchCentricData: result.matchRatings,
        playerCentricData: result.playerCentricRatings,
        keyFormat: {
          matchCentric: 'PK=MATCH#{matchId}, SK=RATING#{playerId}',
          playerCentric: 'PK=PLAYER#{playerId}, SK=MATCH#{matchId}'
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/debug-ratings:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
