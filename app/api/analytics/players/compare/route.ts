import { NextRequest, NextResponse } from 'next/server';
import { createComparisonPlayer } from '../../../../../lib/analytics/comparison';
import { getPlayersWithMatches } from '../../../../../lib/playerService';
import { getPositionGroup } from '../../../../../lib/positions';
import type { AnalysisWindow, RecentMatch } from '../../../../../lib/types';

export const runtime = 'nodejs';

type CompareBody = { playerIds?: unknown; position?: unknown; window?: unknown; dateFrom?: unknown; dateTo?: unknown };
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function matchDate(match: RecentMatch) {
  return (match.matchDateTime ?? match.matchDate ?? match.createdAt ?? '').slice(0, 10);
}

export async function POST(request: NextRequest) {
  let body: CompareBody;
  try { body = await request.json() as CompareBody; }
  catch { return NextResponse.json({ message: 'Body JSON không hợp lệ.' }, { status: 400 }); }

  const playerIds = Array.isArray(body.playerIds)
    ? Array.from(new Set(body.playerIds.filter((id): id is string => typeof id === 'string').map((id) => id.trim()).filter(Boolean)))
    : [];
  if (playerIds.length < 2 || playerIds.length > 4) {
    return NextResponse.json({ message: 'Vui lòng chọn từ 2 đến 4 cầu thủ.' }, { status: 400 });
  }
  const window = Number(body.window ?? 10);
  if (![5, 10, 20].includes(window)) return NextResponse.json({ message: 'Cửa sổ chỉ hỗ trợ 5, 10 hoặc 20 trận.' }, { status: 400 });
  const dateFrom = typeof body.dateFrom === 'string' ? body.dateFrom : '';
  const dateTo = typeof body.dateTo === 'string' ? body.dateTo : '';
  if ((dateFrom && !datePattern.test(dateFrom)) || (dateTo && !datePattern.test(dateTo)) || (dateFrom && dateTo && dateFrom > dateTo)) {
    return NextResponse.json({ message: 'Khoảng ngày không hợp lệ.' }, { status: 400 });
  }

  const records = await getPlayersWithMatches(playerIds);
  if (records.length !== playerIds.length) return NextResponse.json({ message: 'Có cầu thủ không tồn tại hoặc đã ngừng hoạt động.' }, { status: 404 });
  const requestedPosition = typeof body.position === 'string' ? body.position.trim() : '';
  const groups = new Set(records.map((record) => getPositionGroup(record.position) ?? record.position));
  if (groups.size > 1 || (requestedPosition && [...groups][0] !== requestedPosition)) {
    return NextResponse.json({ message: 'Chỉ có thể so sánh các cầu thủ cùng nhóm vị trí.' }, { status: 400 });
  }

  const players = records.map(({ matches, ...player }) => {
    const filtered = matches.filter((match) => {
      const date = matchDate(match);
      return (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
    });
    return createComparisonPlayer(player, filtered, window as AnalysisWindow);
  });
  const counts = players.map((player) => player.matchCount);
  const imbalance = Math.max(...counts) - Math.min(...counts) >= 5
    ? 'Số trận giữa các cầu thủ chênh lệch đáng kể; ưu tiên metric theo trận và thận trọng khi kết luận.' : null;
  return NextResponse.json({ position: [...groups][0], window, dateFrom: dateFrom || null, dateTo: dateTo || null, imbalanceWarning: imbalance, players });
}
