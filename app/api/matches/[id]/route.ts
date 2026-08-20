import { NextRequest, NextResponse } from 'next/server';
import { getMatchById, updateMatch, deleteMatch, getMatchWithRatings } from '../../../../lib/matchService';
import { isValidMatchDate, isValidMatchDateTime } from '../../../../lib/match-datetime';
import { isValidFormation, normalizeFormation } from '../../../../lib/formation';

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

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Body phải là một object JSON', code: 'INVALID_REQUEST' }, { status: 400 });
    }
    const allowed = new Set(['matchDate', 'matchDateTime', 'opponentName', 'myScore', 'opponentScore', 'note', 'formation']);
    if (Object.keys(body).some((key) => !allowed.has(key)) || Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'Body không có trường cập nhật hợp lệ', code: 'INVALID_REQUEST' }, { status: 400 });
    }
    if (body.opponentName !== undefined && (typeof body.opponentName !== 'string' || body.opponentName.length > 120)) {
      return NextResponse.json({ error: 'Tên đối thủ phải là chuỗi tối đa 120 ký tự', code: 'INVALID_OPPONENT' }, { status: 400 });
    }
    if (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 1000)) {
      return NextResponse.json({ error: 'Ghi chú phải là chuỗi tối đa 1000 ký tự', code: 'INVALID_NOTE' }, { status: 400 });
    }
    if (body.formation !== undefined && !isValidFormation(body.formation)) {
      return NextResponse.json({ error: 'Sơ đồ không hợp lệ. Hãy nhập 3–5 tuyến có tổng bằng 10, ví dụ 4-5-1.', code: 'INVALID_FORMATION' }, { status: 400 });
    }
    if (body.formation !== undefined) body.formation = normalizeFormation(body.formation);

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
    if (body.matchDate && !isValidMatchDate(body.matchDate)) {
      return NextResponse.json(
        {
          error: 'matchDate must be in YYYY-MM-DD format',
          code: 'INVALID_DATE_FORMAT'
        },
        { status: 400 }
      );
    }

    if (body.matchDateTime && !isValidMatchDateTime(body.matchDateTime)) {
      return NextResponse.json(
        {
          error: 'matchDateTime phải là thời gian ISO hợp lệ',
          code: 'INVALID_DATETIME_FORMAT'
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
