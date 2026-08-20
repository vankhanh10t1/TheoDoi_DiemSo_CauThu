import { sql } from './db';
import { sortRecentMatchesNewestFirst } from './match-history';
import { getPositionGroup, isDetailedPositionForGroup, isPositionGroup } from './positions';
import { normalizePlayerName } from './player-name';
import type { PlayerSummary, RecentMatch } from './types';
import type { MatchTagFilters } from './match-tags';

type PlayerRow = {
  player_id: string;
  name: string;
  card_season: string;
  position: string;
};

type PlayerHistoryRow = {
  player_id: string;
  match_id: string;
  match_date: string | Date | null;
  match_time: string | null;
  match_datetime: string | Date | null;
  result: 'Win' | 'Draw' | 'Loss';
  is_big_win: boolean | null;
  is_big_loss: boolean | null;
  rating: string | number;
  rated_position: string | null;
  yellow_cards: number | null;
  red_cards: number | null;
  fouls: number | null;
  goals: number | null;
  assists: number | null;
  note: string | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
  formation: string | null;
  is_starter: boolean | null;
  minutes_played: number | null;
  substitution_minute: number | null;
  season: string | null;
  competition: string | null;
  match_type: string | null;
};

export type DeletePlayersResult = {
  requestedCount: number;
  deletedPlayerIds: string[];
  deletedItemCount: number;
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

function mapPlayerRow(row: PlayerRow): PlayerSummary {
  return {
    playerId: row.player_id,
    name: row.name,
    cardSeason: row.card_season,
    position: row.position
  };
}

function mapRecentMatchRow(row: PlayerHistoryRow): RecentMatch {
  const detailedPosition = row.rated_position;
  const positionGroup = getPositionGroup(detailedPosition);
  const validPositionGroup = isPositionGroup(positionGroup) ? positionGroup : undefined;
  const validDetailedPosition =
    validPositionGroup && isDetailedPositionForGroup(validPositionGroup, detailedPosition)
      ? detailedPosition
      : undefined;

  return {
    sk: `MATCH#${row.match_id}`,
    matchId: row.match_id,
    matchDateTime: toIsoLike(row.match_datetime),
    matchDate: toDateOnly(row.match_date),
    matchTime: row.match_time ?? undefined,
    createdAt: toIsoLike(row.created_at),
    updatedAt: toIsoLike(row.updated_at),
    score: Number(row.rating),
    result: row.result,
    positionGroup: validPositionGroup,
    detailedPosition: validDetailedPosition,
    yellowCards: row.yellow_cards ?? 0,
    redCards: row.red_cards ?? 0,
    fouls: row.fouls ?? 0,
    goals: row.goals ?? 0,
    assists: row.assists ?? 0,
    note: row.note ?? undefined,
    formation: row.formation ?? undefined,
    matchPosition: validDetailedPosition,
    isStarter: row.is_starter ?? true,
    minutesPlayed: row.minutes_played ?? undefined,
    substitutionMinute: row.substitution_minute ?? undefined,
    isBigWin: !!row.is_big_win,
    isBigLoss: !!row.is_big_loss
    ,season: row.season ?? undefined, competition: row.competition ?? undefined, matchType: row.match_type ?? undefined
  };
}

export async function listPlayers(): Promise<PlayerSummary[]> {
  const rows = (await sql`
    select player_id, name, card_season, position
    from players
    where is_active = true
    order by
      case
        when position = 'GK' then 1
        when position in ('CB', 'LB', 'LWB', 'RB', 'RWB') then 2
        when position in ('CM', 'CDM', 'CAM', 'LM', 'RM') then 3
        when position in ('ST', 'CF', 'LW', 'RW') then 4
        else 5
      end,
      name asc
  `) as PlayerRow[];

  return rows.map(mapPlayerRow);
}

export async function getPlayerMetadata(playerId: string): Promise<PlayerSummary | null> {
  const rows = (await sql`
    select player_id, name, card_season, position
    from players
    where player_id = ${playerId}
      and is_active = true
    limit 1
  `) as PlayerRow[];

  return rows[0] ? mapPlayerRow(rows[0]) : null;
}

export async function getRecentMatches(playerId: string, limit?: number, filters: MatchTagFilters = {}): Promise<RecentMatch[]> {
  const rows = (await sql`
    select
      player_id,
      match_id,
      match_date,
      match_time::text as match_time,
      match_datetime,
      result,
      is_big_win,
      is_big_loss,
      rating,
      rated_position,
      yellow_cards,
      red_cards,
      fouls,
      goals,
      assists,
      note,
      formation, is_starter, minutes_played, substitution_minute, season, competition, match_type,
      created_at,
      updated_at
    from v_player_match_history
    where player_id = ${playerId}
      and (${filters.season ?? null}::text is null or lower(season) = lower(${filters.season ?? null}))
      and (${filters.competition ?? null}::text is null or lower(competition) = lower(${filters.competition ?? null}))
      and (${filters.matchType ?? null}::text is null or lower(match_type) = lower(${filters.matchType ?? null}))
    order by match_date desc, match_time desc nulls last, created_at desc
  `) as PlayerHistoryRow[];

  const matches = sortRecentMatchesNewestFirst(rows.map(mapRecentMatchRow)).filter((match) =>
    Number.isFinite(match.score)
  );

  return typeof limit === 'number' ? matches.slice(0, limit) : matches;
}

export async function getPlayersWithMatches(playerIds: string[]): Promise<Array<PlayerSummary & { matches: RecentMatch[] }>> {
  const uniqueIds = Array.from(new Set(playerIds));
  const [rawPlayerRows, rawHistoryRows] = await Promise.all([
    sql`select player_id, name, card_season, position from players where is_active = true and player_id = any(${uniqueIds}::text[])`,
    sql`
      select player_id, match_id, match_date, match_time::text as match_time, match_datetime,
        result, is_big_win, is_big_loss, rating, rated_position, yellow_cards, red_cards,
        fouls, goals, assists, note, created_at, updated_at, formation, is_starter, minutes_played, substitution_minute
      from v_player_match_history
      where player_id = any(${uniqueIds}::text[])
      order by match_date desc, match_time desc nulls last, created_at desc
    `
  ]);
  const playerRows = rawPlayerRows as PlayerRow[];
  const historyRows = rawHistoryRows as PlayerHistoryRow[];
  const histories = new Map<string, RecentMatch[]>();
  for (const row of historyRows) {
    const match = mapRecentMatchRow(row);
    if (Number.isFinite(match.score)) histories.set(row.player_id, [...(histories.get(row.player_id) ?? []), match]);
  }
  return playerRows.map((row) => ({ ...mapPlayerRow(row), matches: sortRecentMatchesNewestFirst(histories.get(row.player_id) ?? []) }));
}

export async function findDuplicatePlayerByName(
  playerName: string,
  excludePlayerId?: string
): Promise<string | null> {
  const normalizedName = normalizePlayerName(playerName);
  const rows = (await sql`
    select player_id
    from players
    where normalized_name = ${normalizedName}
      and (${excludePlayerId ?? null}::text is null or player_id <> ${excludePlayerId ?? null})
    limit 1
  `) as Array<{ player_id: string }>;

  return rows[0]?.player_id ?? null;
}

export async function deletePlayersAndRelatedData(playerIds: string[]): Promise<DeletePlayersResult> {
  const uniquePlayerIds = Array.from(
    new Set(playerIds.map((playerId) => playerId.trim()).filter(Boolean))
  );

  if (uniquePlayerIds.length === 0) {
    return {
      requestedCount: 0,
      deletedPlayerIds: [],
      deletedItemCount: 0
    };
  }

  const counts = (await sql`
    select count(*)::int as count
    from match_ratings
    where player_id = any(${uniquePlayerIds}::text[])
  `) as Array<{ count: number }>;

  const deletedPlayers = (await sql`
    delete from players
    where player_id = any(${uniquePlayerIds}::text[])
    returning player_id
  `) as Array<{ player_id: string }>;

  return {
    requestedCount: uniquePlayerIds.length,
    deletedPlayerIds: deletedPlayers.map((row) => row.player_id),
    deletedItemCount: (counts[0]?.count ?? 0) + deletedPlayers.length
  };
}

export { normalizePlayerName };
