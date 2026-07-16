import { NextRequest, NextResponse } from 'next/server';
import { createMatch, listMatches } from '../../../lib/matchService';
import type { CreateMatchPayload } from '../../../lib/types';
import { createSubmitMatchDateTime, isValidMatchDate, isValidMatchDateTime } from '../../../lib/match-datetime';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.matchDate || body.myScore === undefined || body.opponentScore === undefined) {
      return NextResponse.json(
        {
          error: 'Vui long nhap day du ngay thi dau va ti so',
          code: 'INVALID_REQUEST'
        },
        { status: 400 }
      );
    }

    if (!Number.isInteger(body.myScore) || !Number.isInteger(body.opponentScore) || body.myScore < 0 || body.opponentScore < 0) {
      return NextResponse.json(
        {
          error: 'Scores must be non-negative integers',
          code: 'INVALID_SCORE'
        },
        { status: 400 }
      );
    }

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
          error: 'matchDateTime phai la thoi gian ISO hop le',
          code: 'INVALID_DATETIME_FORMAT'
        },
        { status: 400 }
      );
    }

    const payload: CreateMatchPayload = {
      matchDate: body.matchDate,
      matchDateTime: body.matchDateTime ?? createSubmitMatchDateTime(),
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
        message: `Tao tran dau thanh cong: ${match.opponentName || 'N/A'} (${match.myScore}-${match.opponentScore})`
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/matches:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create match',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to list matches',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
