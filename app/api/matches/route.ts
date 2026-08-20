import { NextRequest, NextResponse } from 'next/server';
import { createMatch, listMatches } from '../../../lib/matchService';
import type { CreateMatchPayload } from '../../../lib/types';
import { createSubmitMatchDateTime, isValidMatchDate, isValidMatchDateTime } from '../../../lib/match-datetime';
import { isValidFormation, normalizeFormation } from '../../../lib/formation';
import { normalizeMatchTag, validateMatchTag } from '../../../lib/match-tags';

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
    if (body.formation !== undefined && !isValidFormation(body.formation)) {
      return NextResponse.json({ error: 'Sơ đồ không hợp lệ. Hãy nhập 3–5 tuyến có tổng bằng 10, ví dụ 4-5-1.', code: 'INVALID_FORMATION' }, { status: 400 });
    }
    for (const key of ['season', 'competition', 'matchType'] as const) if (!validateMatchTag(body[key])) return NextResponse.json({ error: `${key} phải là chuỗi tối đa 80 ký tự`, code: 'INVALID_MATCH_TAG' }, { status: 400 });

    const payload: CreateMatchPayload = {
      matchDate: body.matchDate,
      matchDateTime: body.matchDateTime ?? createSubmitMatchDateTime(),
      opponentName: body.opponentName,
      myScore: body.myScore,
      opponentScore: body.opponentScore,
      note: body.note
      ,formation: normalizeFormation(body.formation)
      ,season: normalizeMatchTag(body.season), competition: normalizeMatchTag(body.competition), matchType: normalizeMatchTag(body.matchType)
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

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const parseInteger = (name: string, fallback: number, maximum: number) => {
      const raw = params.get(name);
      if (raw === null) return fallback;
      const value = Number(raw);
      if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`${name} phải là số nguyên từ 1 đến ${maximum}`);
      return value;
    };
    const result = params.get('result');
    const sortBy = params.get('sortBy') ?? 'date';
    const sortOrder = params.get('sortOrder') ?? 'desc';
    const dateFrom = params.get('dateFrom') || undefined;
    const dateTo = params.get('dateTo') || undefined;
    for (const key of ['season', 'competition', 'matchType'] as const) if (!validateMatchTag(params.get(key))) throw new Error(`${key} phải là chuỗi tối đa 80 ký tự`);
    if (result && !['WIN', 'DRAW', 'LOSE'].includes(result)) throw new Error('result không hợp lệ');
    if (!['date', 'rating'].includes(sortBy)) throw new Error('sortBy không hợp lệ');
    if (!['asc', 'desc'].includes(sortOrder)) throw new Error('sortOrder không hợp lệ');
    if ((dateFrom && !isValidMatchDate(dateFrom)) || (dateTo && !isValidMatchDate(dateTo))) throw new Error('Khoảng ngày phải có định dạng YYYY-MM-DD');
    if (dateFrom && dateTo && dateFrom > dateTo) throw new Error('Ngày bắt đầu không được sau ngày kết thúc');
    const matches = await listMatches({
      page: parseInteger('page', 1, 1_000_000), pageSize: parseInteger('pageSize', 10, 100),
      search: params.get('search') || undefined, opponent: params.get('opponent') || undefined,
      result: (result || undefined) as 'WIN' | 'DRAW' | 'LOSE' | undefined,
      playerId: params.get('playerId') || undefined, dateFrom, dateTo,
      season: normalizeMatchTag(params.get('season')), competition: normalizeMatchTag(params.get('competition')), matchType: normalizeMatchTag(params.get('matchType')),
      sortBy: sortBy as 'date' | 'rating', sortOrder: sortOrder as 'asc' | 'desc'
    });

    return NextResponse.json(
      {
        success: true,
        ...matches,
        matches: matches.items
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
      { status: error instanceof Error && /không hợp lệ|phải|không được/.test(error.message) ? 400 : 500 }
    );
  }
}
