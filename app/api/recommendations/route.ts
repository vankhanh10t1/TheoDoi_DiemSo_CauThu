import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';
import { buildRecommendationsFromTableItems } from '../../../lib/recommendationService';

export const runtime = 'nodejs';

type PlayerRow = {
  player_id: string;
  name: string;
  card_season: string;
  position: string;
};

type HistoryRow = {
  player_id: string;
  match_id: string;
  match_date: string | Date | null;
  match_time: string | null;
  match_datetime: string | Date | null;
  result: 'Win' | 'Draw' | 'Loss';
  rating: string | number;
  yellow_cards: number | null;
  red_cards: number | null;
  fouls: number | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
};

function toIsoLike(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : String(value);
}

function toDateOnly(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

async function loadRecommendationItems(): Promise<Array<Record<string, unknown>>> {
  const players = (await sql`
    select player_id, name, card_season, position
    from players
    where is_active = true
  `) as PlayerRow[];

  const histories = (await sql`
    select
      player_id,
      match_id,
      match_date,
      match_time::text as match_time,
      match_datetime,
      result,
      rating,
      yellow_cards,
      red_cards,
      fouls,
      created_at,
      updated_at
    from v_player_match_history
  `) as HistoryRow[];

  return [
    ...players.map((player) => ({
      PK: `PLAYER#${player.player_id}`,
      SK: 'METADATA',
      Name: player.name,
      CardSeason: player.card_season,
      Position: player.position
    })),
    ...histories.map((history) => ({
      PK: `PLAYER#${history.player_id}`,
      SK: `MATCH#${history.match_id}`,
      MatchId: history.match_id,
      MatchDateTime: toIsoLike(history.match_datetime),
      MatchDate: toDateOnly(history.match_date),
      MatchTime: history.match_time ?? undefined,
      CreatedAt: toIsoLike(history.created_at),
      UpdatedAt: toIsoLike(history.updated_at),
      Score: Number(history.rating),
      Result: history.result,
      YellowCards: history.yellow_cards ?? 0,
      RedCards: history.red_cards ?? 0,
      Fouls: history.fouls ?? 0
    }))
  ];
}

export async function GET() {
  try {
    const tableItems = await loadRecommendationItems();
    const ranked = buildRecommendationsFromTableItems(tableItems);

    return NextResponse.json(
      { recommendations: ranked, totalCount: ranked.length },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/recommendations:', error);
    return NextResponse.json(
      {
        error: 'Khong the tai danh sach de xuat.',
        code: 'INTERNAL_ERROR',
        ...(process.env.NODE_ENV === 'development'
          ? { detail: error instanceof Error ? error.message : String(error) }
          : {})
      },
      { status: 500 }
    );
  }
}
