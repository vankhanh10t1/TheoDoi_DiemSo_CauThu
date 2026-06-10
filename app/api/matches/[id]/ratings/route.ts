import { NextRequest, NextResponse } from 'next/server';
import { saveMatchRatings, getMatchRatings, getMatchById, deletePlayerMatchRating } from '../../../../../lib/matchService';
import { getPlayerMetadata, listPlayers } from '../../../../../lib/playerService';
import { isDynamoThrottleError } from '../../../../../lib/dynamodb-helpers';
import { hasAtMostOneDecimalPlace, parseDecimalRating } from '../../../../../lib/rating-validation';
import type { SaveMatchRatingsPayload } from '../../../../../lib/types';

/**
 * POST /api/matches/:id/ratings - Save multiple player ratings for a match
 * Body: { ratings: [{ playerId, rating, position?, yellowCards?, redCards?, fouls?, goals?, assists?, note? }, ...] }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: matchId } = await params;
    const body = await request.json();

    console.info(`[api] POST /api/matches/${matchId}/ratings payload`, {
      ratingCount: Array.isArray(body.ratings) ? body.ratings.length : 0
    });

    // Check if match exists
    const match = await getMatchById(matchId);
    if (!match) {
      return NextResponse.json(
        {
          error: `Không tìm thấy trận đấu ${matchId}`,
          code: 'MATCH_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    // Validate payload structure
    if (!Array.isArray(body.ratings) || body.ratings.length === 0) {
      return NextResponse.json(
        {
          error: 'ratings must be a non-empty array',
          code: 'INVALID_REQUEST'
        },
        { status: 400 }
      );
    }

    // Get list of valid players for validation
    const validPlayers = await listPlayers();
    const playerIds = new Set(validPlayers.map((p) => p.playerId.toLowerCase()));

    // Validate each rating
    for (const rating of body.ratings) {
      if (!rating.playerId || rating.rating === undefined) {
        return NextResponse.json(
          {
            error: 'Each rating must have playerId and rating',
            code: 'INVALID_RATING'
          },
          { status: 400 }
        );
      }

      const parsedRating = parseDecimalRating(rating.rating);

      if (parsedRating === null || parsedRating < 1 || parsedRating > 10) {
        return NextResponse.json(
          {
            error: `Rating must be between 1 and 10 (got ${rating.rating})`,
            code: 'INVALID_RATING_SCORE'
          },
          { status: 400 }
        );
      }

      if (!hasAtMostOneDecimalPlace(parsedRating)) {
        return NextResponse.json(
          {
            error: 'Rating must have at most 1 decimal place',
            code: 'INVALID_RATING_PRECISION'
          },
          { status: 400 }
        );
      }

      rating.rating = Math.round(parsedRating * 10) / 10;

      if (!playerIds.has(rating.playerId.toLowerCase())) {
        return NextResponse.json(
          {
            error: `Cầu thủ ${rating.playerId} không tồn tại`,
            code: 'PLAYER_NOT_FOUND'
          },
          { status: 404 }
        );
      }

      if (rating.goals !== undefined && (!Number.isInteger(rating.goals) || rating.goals < 0)) {
        return NextResponse.json(
          {
            error: 'Goals must be non-negative integers',
            code: 'INVALID_GOALS'
          },
          { status: 400 }
        );
      }

      if (rating.yellowCards !== undefined && (!Number.isInteger(rating.yellowCards) || rating.yellowCards < 0)) {
        return NextResponse.json(
          {
            error: 'Yellow cards must be non-negative integers',
            code: 'INVALID_YELLOW_CARDS'
          },
          { status: 400 }
        );
      }

      if (rating.redCards !== undefined && (!Number.isInteger(rating.redCards) || rating.redCards < 0)) {
        return NextResponse.json(
          {
            error: 'Red cards must be non-negative integers',
            code: 'INVALID_RED_CARDS'
          },
          { status: 400 }
        );
      }

      if (rating.fouls !== undefined && (!Number.isInteger(rating.fouls) || rating.fouls < 0)) {
        return NextResponse.json(
          {
            error: 'Fouls must be non-negative integers',
            code: 'INVALID_FOULS'
          },
          { status: 400 }
        );
      }

      if (rating.assists !== undefined && (!Number.isInteger(rating.assists) || rating.assists < 0)) {
        return NextResponse.json(
          {
            error: 'Assists must be non-negative integers',
            code: 'INVALID_ASSISTS'
          },
          { status: 400 }
        );
      }
    }

    const payload: SaveMatchRatingsPayload = { ratings: body.ratings };
    const result = await saveMatchRatings(matchId, payload);

    console.info(`[api] /api/matches/${matchId}/ratings saved`, { created: result.created, updated: result.updated });

    return NextResponse.json(
      {
        success: true,
        created: result.created,
        updated: result.updated,
        message: `✅ Lưu ${result.created + result.updated} đánh giá cho trận đấu (${result.created} mới, ${result.updated} cập nhật)`
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/matches/:id/ratings:', error);
    if (isDynamoThrottleError(error)) {
      return NextResponse.json(
        {
          error: 'DynamoDB đang bị giới hạn ghi khi lưu rating. Vui lòng thử lại sau vài giây.',
          code: 'DYNAMODB_THROTTLED'
        },
        { status: 429 }
      );
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to save match ratings',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/matches/:id/ratings - Get all ratings for a match
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: matchId } = await params;

    // Check if match exists
    const match = await getMatchById(matchId);
    if (!match) {
      return NextResponse.json(
        {
          error: `Không tìm thấy trận đấu ${matchId}`,
          code: 'MATCH_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    const ratings = (await getMatchRatings(matchId)).filter((rating) => Number.isFinite(rating.rating));
    const players = await Promise.all(ratings.map((rating) => getPlayerMetadata(rating.playerId)));
    const ratingDetails = ratings.map((rating, index) => {
        const player = players[index];
        return {
          ...rating,
          playerName: player?.name ?? rating.playerId,
          cardSeason: player?.cardSeason,
          playerPosition: player?.position
        };
      });

    return NextResponse.json(
      {
        success: true,
        match,
        ratings: ratingDetails,
        count: ratingDetails.length
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/matches/:id/ratings:', error);
    if (isDynamoThrottleError(error)) {
      return NextResponse.json(
        {
          error: 'DynamoDB đang bị giới hạn đọc. Vui lòng thử lại sau vài giây.',
          code: 'DYNAMODB_THROTTLED'
        },
        { status: 429 }
      );
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get match ratings',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/matches/:id/ratings/:playerId - Delete a player rating from a match
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: matchId } = await params;
    const url = new URL(request.url);
    const playerId = url.searchParams.get('playerId');

    if (!playerId) {
      return NextResponse.json(
        {
          error: 'playerId query parameter is required',
          code: 'MISSING_PLAYER_ID'
        },
        { status: 400 }
      );
    }

    // Check if match exists
    const match = await getMatchById(matchId);
    if (!match) {
      return NextResponse.json(
        {
          error: `Không tìm thấy trận đấu ${matchId}`,
          code: 'MATCH_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    const success = await deletePlayerMatchRating(matchId, playerId);
    if (!success) {
      return NextResponse.json(
        {
          error: `Failed to delete rating`,
          code: 'DELETE_FAILED'
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Xóa đánh giá cầu thủ ${playerId} thành công`
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in DELETE /api/matches/:id/ratings:', error);
    if (isDynamoThrottleError(error)) {
      return NextResponse.json(
        {
          error: 'DynamoDB đang bị giới hạn ghi khi xóa rating. Vui lòng thử lại sau vài giây.',
          code: 'DYNAMODB_THROTTLED'
        },
        { status: 429 }
      );
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete rating',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
