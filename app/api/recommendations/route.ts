import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../lib/db';
import { buildRecommendationsFromTableItems } from '../../../lib/recommendationService';
import { normalizeAnalysisWindow } from '../../../lib/analytics/config';
import { normalizeMatchTag } from '../../../lib/match-tags';
import { normalizeWeightProfile } from '../../../lib/analytics/performance-config';

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
  goals: number | null; assists: number | null; is_starter: boolean | null; minutes_played: number | null;
  rated_position: string | null; season: string | null; competition: string | null; match_type: string | null;
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

async function loadRecommendationItems(filters: { season?: string; competition?: string; matchType?: string }): Promise<Array<Record<string, unknown>>> {
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
      goals, assists, is_starter, minutes_played, rated_position, season, competition, match_type,
      created_at,
      updated_at
    from v_player_match_history
    where (${filters.season ?? null}::text is null or lower(season) = lower(${filters.season ?? null}))
      and (${filters.competition ?? null}::text is null or lower(competition) = lower(${filters.competition ?? null}))
      and (${filters.matchType ?? null}::text is null or lower(match_type) = lower(${filters.matchType ?? null}))
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
      ,Goals: history.goals ?? 0, Assists: history.assists ?? 0, IsStarter: history.is_starter ?? true,
      MinutesPlayed: history.minutes_played ?? undefined, PositionGroup: history.rated_position,
      Season: history.season ?? undefined, Competition: history.competition ?? undefined, MatchType: history.match_type ?? undefined
    }))
  ];
}

export async function GET(request: NextRequest) {
  try {
    const analysisWindow = normalizeAnalysisWindow(Number(request.nextUrl.searchParams.get('window')));
    const weightProfile = normalizeWeightProfile(request.nextUrl.searchParams.get('weightProfile'));
    const filters = { season: normalizeMatchTag(request.nextUrl.searchParams.get('season')), competition: normalizeMatchTag(request.nextUrl.searchParams.get('competition')), matchType: normalizeMatchTag(request.nextUrl.searchParams.get('matchType')) };
    const tableItems = await loadRecommendationItems(filters);
    const ranked = buildRecommendationsFromTableItems(tableItems, analysisWindow, weightProfile);

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
