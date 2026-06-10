import { NextRequest, NextResponse } from 'next/server';
import { createMatch, listMatches } from '../../../lib/matchService';
import { isDynamoThrottleError } from '../../../lib/dynamodb-helpers';
import type { CreateMatchPayload } from '../../../lib/types';
import { isValidMatchDate, isValidMatchDateTime } from '../../../lib/match-datetime';

/**
 * POST /api/matches - Create a new match
 * Body: { matchDate, matchDateTime, opponentName?, myScore, opponentScore, note? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.matchDate || body.myScore === undefined || body.opponentScore === undefined) {
      return NextResponse.json(
        {
          error: 'Vui lòng nhập đầy đủ ngày thi đấu và tỉ số',
          code: 'INVALID_REQUEST'
        },
        { status: 400 }
      );
    }

    // Validate score is non-negative integer
    if (!Number.isInteger(body.myScore) || !Number.isInteger(body.opponentScore) || body.myScore < 0 || body.opponentScore < 0) {
      return NextResponse.json(
        {
          error: 'Scores must be non-negative integers',
          code: 'INVALID_SCORE'
        },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    if (!isValidMatchDate(body.matchDate)) {
      return NextResponse.json(
        {
          error: 'matchDate must be in YYYY-MM-DD format',
          code: 'INVALID_DATE_FORMAT'
        },
        { status: 400 }
      );
    }

    if (body.matchDateTime !== undefined && !isValidMatchDateTime(body.matchDateTime)) {
      return NextResponse.json(
        {
          error: 'matchDateTime phải là thời gian ISO hợp lệ',
          code: 'INVALID_DATETIME_FORMAT'
        },
        { status: 400 }
      );
    }

    const payload: CreateMatchPayload = {
      matchDate: body.matchDate,
      matchDateTime: body.matchDateTime ?? new Date().toISOString(),
      opponentName: body.opponentName,
      myScore: body.myScore,
      opponentScore: body.opponentScore,
      note: body.note
    };

    const match = await createMatch(payload);

    return NextResponse.json(
      {
        success: true,
        match,
        message: `Tạo trận đấu thành công: ${match.opponentName || 'N/A'} (${match.myScore}-${match.opponentScore})`
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/matches:', error);
    if (isDynamoThrottleError(error)) {
      return NextResponse.json(
        {
          error: 'DynamoDB đang bị giới hạn ghi. Vui lòng thử lại sau vài giây.',
          code: 'DYNAMODB_THROTTLED'
        },
        { status: 429 }
      );
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create match',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/matches - List all matches
 */
export async function GET() {
  try {
    const matches = await listMatches();

    return NextResponse.json(
      {
        success: true,
        matches,
        total: matches.length
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/matches:', error);
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
        error: error instanceof Error ? error.message : 'Failed to list matches',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
