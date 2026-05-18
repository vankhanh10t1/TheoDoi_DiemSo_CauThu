import { NextRequest, NextResponse } from 'next/server';
import { getMatchById, updateMatch, deleteMatch, getMatchWithRatings } from '../../../../lib/matchService';

/**
 * GET /api/matches/:id - Get match by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const match = await getMatchById(id);
    if (!match) {
      return NextResponse.json(
        {
          error: `Không tìm thấy trận đấu ${id}`,
          code: 'NOT_FOUND'
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        match
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/matches/:id:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get match',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/matches/:id - Update match
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate scores if provided
    if (body.myScore !== undefined || body.opponentScore !== undefined) {
      if (
        (body.myScore !== undefined && (!Number.isInteger(body.myScore) || body.myScore < 0)) ||
        (body.opponentScore !== undefined && (!Number.isInteger(body.opponentScore) || body.opponentScore < 0))
      ) {
        return NextResponse.json(
          {
            error: 'Scores must be non-negative integers',
            code: 'INVALID_SCORE'
          },
          { status: 400 }
        );
      }
    }

    // Validate date format if provided
    if (body.matchDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.matchDate)) {
      return NextResponse.json(
        {
          error: 'matchDate must be in YYYY-MM-DD format',
          code: 'INVALID_DATE_FORMAT'
        },
        { status: 400 }
      );
    }

    const updated = await updateMatch(id, body);
    if (!updated) {
      return NextResponse.json(
        {
          error: `Không tìm thấy trận đấu ${id}`,
          code: 'NOT_FOUND'
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        match: updated,
        message: `Cập nhật trận đấu thành công`
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in PATCH /api/matches/:id:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update match',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/matches/:id - Delete match and all its ratings
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if match exists
    const existing = await getMatchById(id);
    if (!existing) {
      return NextResponse.json(
        {
          error: `Không tìm thấy trận đấu ${id}`,
          code: 'NOT_FOUND'
        },
        { status: 404 }
      );
    }

    const success = await deleteMatch(id);
    if (!success) {
      throw new Error('Failed to delete match');
    }

    return NextResponse.json(
      {
        success: true,
        message: `Xóa trận đấu thành công`
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in DELETE /api/matches/:id:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete match',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
