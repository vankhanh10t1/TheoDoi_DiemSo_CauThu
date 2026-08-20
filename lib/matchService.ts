import { sql } from './db';
import { createMatchDateTime } from './match-datetime';
import type {
  Match,
  PlayerMatchRating,
  CreateMatchPayload,
  SaveMatchRatingsPayload
} from './types';

type MatchRow = {
  match_id: string;
  match_date: string | Date;
  match_time: string | null;
  match_datetime: string | Date | null;
  opponent_name: string | null;
  my_score: number;
  opponent_score: number;
  result: 'WIN' | 'DRAW' | 'LOSE';
  is_big_win: boolean;
  is_big_loss: boolean;
  note: string | null;
  formation: string | null;
  rating_count?: number;
  average_rating?: string | number | null;
  rating_version: number;
  created_at: string | Date;
  updated_at: string | Date;
};

type RatingRow = {
  match_id: string;
  player_id: string;
  rating: string | number;
  position: string | null;
  yellow_cards: number | null;
  red_cards: number | null;
  fouls: number | null;
  goals: number | null;
  assists: number | null;
  note: string | null;
  is_starter: boolean | null;
  minutes_played: number | null;
  substitution_minute: number | null;
  created_at: string | Date;
  updated_at: string | Date;
};

function formatMatchTimestamp(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function generateMatchId(): string {
  return `match_${formatMatchTimestamp()}_${crypto.randomUUID().slice(0, 8)}`;
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function toIsoLike(value: string | Date | null | undefined): string {
  if (!value) return '';
  return value instanceof Date ? value.toISOString() : String(value);
}

function toDateOnly(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapMatchRow(row: MatchRow): Match {
  return {
    id: row.match_id,
    matchDate: toDateOnly(row.match_date),
    matchDateTime: row.match_datetime ? toIsoLike(row.match_datetime) : undefined,
    matchTime: row.match_time ?? undefined,
    opponentName: row.opponent_name ?? undefined,
    myScore: row.my_score,
    opponentScore: row.opponent_score,
    result: row.result,
    isBigWin: !!row.is_big_win,
    isBigLoss: !!row.is_big_loss,
    note: row.note ?? undefined,
    formation: row.formation ?? undefined,
    ratingCount: row.rating_count,
    averageRating: row.average_rating == null ? undefined : Number(row.average_rating),
    ratingVersion: row.rating_version,
    createdAt: toIsoLike(row.created_at),
    updatedAt: toIsoLike(row.updated_at)
  };
}

function mapRatingRow(row: RatingRow): PlayerMatchRating {
  return {
    id: `${row.match_id}#${row.player_id}`,
    matchId: row.match_id,
    playerId: row.player_id,
    rating: Number(row.rating),
    position: (row.position ?? undefined) as PlayerMatchRating['position'],
    matchPosition: (row.position ?? undefined) as PlayerMatchRating['matchPosition'],
    isStarter: row.is_starter ?? true,
    minutesPlayed: row.minutes_played ?? undefined,
    substitutionMinute: row.substitution_minute ?? undefined,
    yellowCards: row.yellow_cards ?? 0,
    redCards: row.red_cards ?? 0,
    fouls: row.fouls ?? 0,
    goals: row.goals ?? 0,
    assists: row.assists ?? 0,
    note: row.note ?? undefined,
    createdAt: toIsoLike(row.created_at),
    updatedAt: toIsoLike(row.updated_at)
  };
}

function toDbMatchTime(matchDateTime?: string): string | null {
  const match = matchDateTime?.match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
}

export function calculateMatchResult(myScore: number, opponentScore: number): 'WIN' | 'DRAW' | 'LOSE' {
  if (myScore > opponentScore) return 'WIN';
  if (myScore === opponentScore) return 'DRAW';
  return 'LOSE';
}

export async function createMatch(payload: CreateMatchPayload): Promise<Match> {
  try {
    const matchId = generateMatchId();
    const now = new Date().toISOString();
    const result = calculateMatchResult(payload.myScore, payload.opponentScore);
    const goalDiff = payload.myScore - payload.opponentScore;
    const isBigWin = goalDiff >= 3;
    const isBigLoss = goalDiff <= -3;
    const matchTime = toDbMatchTime(payload.matchDateTime);

    const rows = (await sql`
      insert into matches (
        match_id,
        match_date,
        match_time,
        match_datetime,
        opponent_name,
        my_score,
        opponent_score,
        result,
        is_big_win,
        is_big_loss,
        note,
        formation,
        rating_version,
        created_at,
        updated_at
      )
      values (
        ${matchId},
        ${payload.matchDate},
        ${matchTime},
        ${payload.matchDateTime},
        ${payload.opponentName ?? null},
        ${payload.myScore},
        ${payload.opponentScore},
        ${result},
        ${isBigWin},
        ${isBigLoss},
        ${payload.note ?? null},
        ${payload.formation ?? null},
        0,
        ${now},
        ${now}
      )
      returning *, 0::int as rating_count
    `) as MatchRow[];

    return mapMatchRow(rows[0]);
  } catch (error) {
    console.error('Error creating match:', error);
    throw new Error(`Failed to create match: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getMatchById(matchId: string): Promise<Match | null> {
  const rows = (await sql`
    select m.*, count(r.player_id)::int as rating_count
    from matches m
    left join match_ratings r on r.match_id = m.match_id
    where m.match_id = ${matchId}
    group by m.match_id
    limit 1
  `) as MatchRow[];

  return rows[0] ? mapMatchRow(rows[0]) : null;
}

export type MatchListOptions = {
  page: number;
  pageSize: number;
  search?: string;
  opponent?: string;
  result?: Match['result'];
  playerId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy: 'date' | 'rating';
  sortOrder: 'asc' | 'desc';
};

export type PaginatedMatches = {
  items: Match[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function listMatches(options?: Partial<MatchListOptions>): Promise<PaginatedMatches> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 10;
  const conditions: string[] = [];
  const params: unknown[] = [];
  const addCondition = (condition: string, value: unknown) => {
    params.push(value);
    conditions.push(condition.replace('?', `$${params.length}`));
  };
  const search = options?.search?.trim();
  const opponent = options?.opponent?.trim();
  if (search) addCondition("m.opponent_name ilike '%' || ? || '%'", search);
  if (opponent) addCondition("m.opponent_name ilike '%' || ? || '%'", opponent);
  if (options?.result) addCondition('m.result = ?', options.result);
  if (options?.playerId) addCondition('exists (select 1 from match_ratings pr where pr.match_id = m.match_id and pr.player_id = ?)', options.playerId);
  if (options?.dateFrom) addCondition('m.match_date >= ?::date', options.dateFrom);
  if (options?.dateTo) addCondition('m.match_date <= ?::date', options.dateTo);

  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const countRows = (await sql.query(`select count(*)::int as total from matches m ${where}`, params)) as Array<{ total: number }>;
  const total = Number(countRows[0]?.total ?? 0);
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;
  const direction = options?.sortOrder === 'asc' ? 'asc' : 'desc';
  const orderBy = options?.sortBy === 'rating'
    ? `average_rating ${direction} nulls last, m.match_date desc, m.match_id asc`
    : `m.match_date ${direction}, m.match_time ${direction} nulls last, m.created_at ${direction}, m.match_id asc`;
  const rows = (await sql.query(
    `select m.*, count(r.player_id)::int as rating_count, avg(r.rating)::numeric(4,2) as average_rating
     from matches m left join match_ratings r on r.match_id = m.match_id ${where}
     group by m.match_id order by ${orderBy}
     limit $${params.length + 1} offset $${params.length + 2}`,
    [...params, pageSize, offset]
  )) as MatchRow[];

  return { items: rows.map(mapMatchRow), page: safePage, pageSize, total, totalPages };
}

export async function updateMatch(matchId: string, payload: Partial<CreateMatchPayload>): Promise<Match | null> {
  const existing = await getMatchById(matchId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const myScore = payload.myScore ?? existing.myScore;
  const opponentScore = payload.opponentScore ?? existing.opponentScore;
  const result = calculateMatchResult(myScore, opponentScore);
  const goalDiff = myScore - opponentScore;
  const isBigWin = goalDiff >= 3;
  const isBigLoss = goalDiff <= -3;
  const matchDate = payload.matchDate ?? payload.matchDateTime?.slice(0, 10) ?? existing.matchDate;
  const matchDateTime =
    payload.matchDateTime ??
    (payload.matchDate ? createMatchDateTime(payload.matchDate, existing.matchTime ?? '07:00') : existing.matchDateTime);
  const matchTime = toDbMatchTime(matchDateTime) ?? existing.matchTime ?? null;
  const opponentName = Object.prototype.hasOwnProperty.call(payload, 'opponentName') ? payload.opponentName?.trim() || null : existing.opponentName ?? null;
  const note = Object.prototype.hasOwnProperty.call(payload, 'note') ? payload.note?.trim() || null : existing.note ?? null;
  const formation = Object.prototype.hasOwnProperty.call(payload, 'formation') ? payload.formation?.trim() || null : existing.formation ?? null;

  const rows = (await sql`
    update matches
    set
      match_date = ${matchDate},
      match_time = ${matchTime},
      match_datetime = ${matchDateTime ?? null},
      opponent_name = ${opponentName},
      my_score = ${myScore},
      opponent_score = ${opponentScore},
      result = ${result},
      is_big_win = ${isBigWin},
      is_big_loss = ${isBigLoss},
      note = ${note},
      formation = ${formation},
      updated_at = ${now}
    where match_id = ${matchId}
      and rating_version = ${existing.ratingVersion ?? 0}
    returning *, (
      select count(*)::int
      from match_ratings
      where match_id = ${matchId}
    ) as rating_count
  `) as MatchRow[];

  if (!rows[0]) {
    throw new Error('Match was updated elsewhere. Please reload and try again.');
  }

  return mapMatchRow(rows[0]);
}

export async function deleteMatch(matchId: string): Promise<boolean> {
  const rows = (await sql`
    delete from matches
    where match_id = ${matchId}
    returning match_id
  `) as Array<{ match_id: string }>;

  return rows.length > 0;
}

export async function saveMatchRatings(
  matchId: string,
  payload: SaveMatchRatingsPayload
): Promise<{ created: number; updated: number }> {
  const match = await getMatchById(matchId);
  if (!match) {
    throw new Error(`Match ${matchId} not found`);
  }

  const ids = payload.ratings.map((rating) => rating.playerId.toLowerCase());
  if (new Set(ids).size !== ids.length) {
    throw new Error('Duplicate playerId found in ratings payload');
  }
  if (payload.ratings.length > 49) {
    throw new Error('A maximum of 49 ratings can be saved atomically per request');
  }

  const existingRows = (await sql`
    select player_id
    from match_ratings
    where match_id = ${matchId}
  `) as Array<{ player_id: string }>;
  const existingPlayerIds = new Set(existingRows.map((row) => row.player_id.toLowerCase()));
  const created = payload.ratings.filter((rating) => !existingPlayerIds.has(rating.playerId.toLowerCase())).length;
  const updated = payload.ratings.length - created;
  const now = new Date().toISOString();

  const results = await sql.transaction((tx) => [
    ...payload.ratings.map((ratingData) => {
      const rating = roundToOneDecimal(ratingData.rating);
      return tx`
        insert into match_ratings (
          match_id,
          player_id,
          rating,
          position,
          is_starter,
          minutes_played,
          substitution_minute,
          yellow_cards,
          red_cards,
          fouls,
          goals,
          assists,
          note,
          created_at,
          updated_at
        )
        values (
          ${matchId},
          ${ratingData.playerId},
          ${rating},
          ${ratingData.position ?? null},
          ${ratingData.isStarter},
          ${ratingData.minutesPlayed},
          ${ratingData.substitutionMinute ?? null},
          ${ratingData.yellowCards ?? 0},
          ${ratingData.redCards ?? 0},
          ${ratingData.fouls ?? 0},
          ${ratingData.goals ?? 0},
          ${ratingData.assists ?? 0},
          ${ratingData.note ?? null},
          ${now},
          ${now}
        )
        on conflict (match_id, player_id)
        do update set
          rating = excluded.rating,
          position = excluded.position,
          is_starter = excluded.is_starter,
          minutes_played = excluded.minutes_played,
          substitution_minute = excluded.substitution_minute,
          yellow_cards = excluded.yellow_cards,
          red_cards = excluded.red_cards,
          fouls = excluded.fouls,
          goals = excluded.goals,
          assists = excluded.assists,
          note = excluded.note,
          updated_at = excluded.updated_at
      `;
    }),
    tx`
      update matches
      set
        rating_version = rating_version + 1,
        updated_at = ${now}
      where match_id = ${matchId}
        and rating_version = ${match.ratingVersion ?? 0}
      returning match_id
    `
  ]);

  const updateResult = results[results.length - 1] as Array<{ match_id: string }>;
  if (updateResult.length === 0) {
    throw new Error('Match ratings were updated elsewhere. Please reload and try again.');
  }

  return { created, updated };
}

export async function getMatchRatings(matchId: string): Promise<PlayerMatchRating[]> {
  const rows = (await sql`
    select *
    from match_ratings
    where match_id = ${matchId}
    order by player_id asc
  `) as RatingRow[];

  return rows.map(mapRatingRow);
}

export async function debugListMatchRatings(matchId: string) {
  const matchRatings = await getMatchRatings(matchId);
  return { matchRatings, playerCentricRatings: matchRatings };
}

export async function getPlayerMatchRating(matchId: string, playerId: string): Promise<PlayerMatchRating | null> {
  const rows = (await sql`
    select *
    from match_ratings
    where match_id = ${matchId}
      and player_id = ${playerId}
    limit 1
  `) as RatingRow[];

  return rows[0] ? mapRatingRow(rows[0]) : null;
}

export async function deletePlayerMatchRating(matchId: string, playerId: string): Promise<boolean> {
  const match = await getMatchById(matchId);
  if (!match) {
    throw new Error(`Match ${matchId} not found`);
  }

  const now = new Date().toISOString();
  const results = await sql.transaction((tx) => [
    tx`
      delete from match_ratings
      where match_id = ${matchId}
        and lower(player_id) = lower(${playerId})
      returning player_id
    `,
    tx`
      update matches
      set
        rating_version = rating_version + 1,
        updated_at = ${now}
      where match_id = ${matchId}
        and rating_version = ${match.ratingVersion ?? 0}
      returning match_id
    `
  ]);

  const deleted = results[0] as Array<{ player_id: string }>;
  const updated = results[1] as Array<{ match_id: string }>;
  if (updated.length === 0) {
    throw new Error('Match ratings were updated elsewhere. Please reload and try again.');
  }

  return deleted.length > 0;
}

export async function resetPlayerMatchHistory(playerId: string): Promise<number> {
  const existingRows = (await sql`
    select match_id
    from match_ratings
    where player_id = ${playerId}
  `) as Array<{ match_id: string }>;
  const matchIds = Array.from(new Set(existingRows.map((row) => row.match_id)));

  if (matchIds.length === 0) {
    return 0;
  }

  const now = new Date().toISOString();
  await sql.transaction((tx) => [
    tx`
      delete from match_ratings
      where player_id = ${playerId}
    `,
    tx`
      update matches
      set
        rating_version = rating_version + 1,
        updated_at = ${now}
      where match_id = any(${matchIds}::text[])
    `
  ]);

  return matchIds.length;
}

export async function getMatchWithRatings(matchId: string): Promise<{ match: Match; ratings: PlayerMatchRating[] } | null> {
  const match = await getMatchById(matchId);
  if (!match) return null;

  const ratings = await getMatchRatings(matchId);
  return { match, ratings };
}
