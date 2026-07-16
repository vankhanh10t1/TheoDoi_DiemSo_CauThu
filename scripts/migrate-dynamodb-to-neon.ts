import { loadEnvConfig } from '@next/env';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { neon } from '@neondatabase/serverless';
import { getDocumentClient, getTableName } from '../lib/dynamodb';
import { retryWithBackoff } from '../lib/dynamodb-helpers';
import { normalizePlayerName } from '../lib/player-name';

loadEnvConfig(process.cwd());

type TableItem = Record<string, unknown> & {
  PK: string;
  SK: string;
};

type ParsedMatchDateTime = {
  matchDate: string;
  matchTime: string | null;
  matchDateTime: string;
  source: 'MatchDateTime' | 'MatchDate+MatchTime' | 'MatchDate+defaultTime' | 'CreatedAt' | 'UpdatedAt';
};

type InvalidMatchDateTimeLog = {
  matchId: string;
  matchDateTime: string;
  matchDate: string;
  matchTime: string;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_MATCH_TIME = '07:00';
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const vietnamDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: VIETNAM_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function extractMatchId(item: TableItem): string {
  return item.PK.replace(/^MATCH#/, '');
}

function extractPlayerIdFromPlayer(item: TableItem): string {
  return item.PK.replace(/^PLAYER#/, '');
}

function extractPlayerIdFromRating(item: TableItem): string {
  return stringValue(item.PlayerId) || item.SK.replace(/^RATING#/, '');
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function parseDateOnly(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);
    return isValidDateParts(year, month, day) ? `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}` : null;
  }

  const vietnamDate = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (vietnamDate) {
    const day = Number(vietnamDate[1]);
    const month = Number(vietnamDate[2]);
    const year = Number(vietnamDate[3]);
    return isValidDateParts(year, month, day) ? `${year}-${pad2(month)}-${pad2(day)}` : null;
  }

  return null;
}

function parseTimeOnly(value: string): string | null {
  const trimmed = value.trim();
  const time = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!time) return null;

  const hour = Number(time[1]);
  const minute = Number(time[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${pad2(hour)}:${pad2(minute)}`;
}

function getVietnamDateAndTime(date: Date): { matchDate: string; matchTime: string } {
  const parts = Object.fromEntries(
    vietnamDateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  return {
    matchDate: `${parts.year}-${parts.month}-${parts.day}`,
    matchTime: `${parts.hour}:${parts.minute}`
  };
}

function parseInstant(value: string): { matchDate: string; matchTime: string; matchDateTime: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.includes('/')) return null;

  const compactUtc = trimmed.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  const localDateTime = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/
  );
  const candidate = compactUtc
    ? `${compactUtc[1]}-${compactUtc[2]}-${compactUtc[3]}T${compactUtc[4]}:${compactUtc[5]}:${compactUtc[6]}Z`
    : localDateTime
      ? `${localDateTime[1]}T${pad2(Number(localDateTime[2]))}:${localDateTime[3]}:${localDateTime[4] ?? '00'}+07:00`
      : trimmed;

  const timestamp = Date.parse(candidate);
  if (!Number.isFinite(timestamp)) return null;

  const date = new Date(timestamp);
  const vietnam = getVietnamDateAndTime(date);
  return {
    ...vietnam,
    matchDateTime: date.toISOString()
  };
}

function toDbTimestamp(value: unknown, fallback = new Date().toISOString()): string {
  const parsed = parseInstant(stringValue(value));
  return parsed?.matchDateTime ?? fallback;
}

function buildVietnamDateTime(matchDate: string, matchTime: string): string | null {
  const date = parseDateOnly(matchDate);
  const time = parseTimeOnly(matchTime);
  if (!date || !time) return null;

  const dateTime = `${date}T${time}:00+07:00`;
  return Number.isFinite(Date.parse(dateTime)) ? dateTime : null;
}

function parseMatchDateFields(item: TableItem): ParsedMatchDateTime | null {
  const rawMatchDateTime = stringValue(item.MatchDateTime);
  const rawMatchDate = stringValue(item.MatchDate);
  const rawMatchTime = stringValue(item.MatchTime);
  const rawCreatedAt = stringValue(item.CreatedAt);
  const rawUpdatedAt = stringValue(item.UpdatedAt);

  const matchDateTime = parseInstant(rawMatchDateTime);
  if (matchDateTime) {
    return { ...matchDateTime, source: 'MatchDateTime' };
  }

  const parsedMatchDate = parseDateOnly(rawMatchDate);
  const parsedMatchTime = parseTimeOnly(rawMatchTime);
  if (parsedMatchDate && parsedMatchTime) {
    const built = buildVietnamDateTime(parsedMatchDate, parsedMatchTime);
    if (built) {
      return {
        matchDate: parsedMatchDate,
        matchTime: parsedMatchTime,
        matchDateTime: built,
        source: 'MatchDate+MatchTime'
      };
    }
  }

  if (parsedMatchDate) {
    const built = buildVietnamDateTime(parsedMatchDate, DEFAULT_MATCH_TIME);
    if (built) {
      return {
        matchDate: parsedMatchDate,
        matchTime: DEFAULT_MATCH_TIME,
        matchDateTime: built,
        source: 'MatchDate+defaultTime'
      };
    }
  }

  const createdAt = parseInstant(rawCreatedAt);
  if (createdAt) {
    return { ...createdAt, source: 'CreatedAt' };
  }

  const updatedAt = parseInstant(rawUpdatedAt);
  if (updatedAt) {
    return { ...updatedAt, source: 'UpdatedAt' };
  }

  return null;
}

function getInvalidMatchDateTimeLog(matchId: string, item: TableItem): InvalidMatchDateTimeLog {
  return {
    matchId,
    matchDateTime: stringValue(item.MatchDateTime),
    matchDate: stringValue(item.MatchDate),
    matchTime: stringValue(item.MatchTime),
    createdAt: stringValue(item.CreatedAt),
    updatedAt: stringValue(item.UpdatedAt)
  };
}

function normalizeResult(value: unknown): 'WIN' | 'DRAW' | 'LOSE' {
  if (value === 'WIN' || value === 'Win') return 'WIN';
  if (value === 'DRAW' || value === 'Draw') return 'DRAW';
  return 'LOSE';
}

async function scanAllItems(): Promise<TableItem[]> {
  const items: TableItem[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await retryWithBackoff(
      () =>
        getDocumentClient().send(
          new ScanCommand({
            TableName: getTableName(),
            ExclusiveStartKey: exclusiveStartKey
          })
        ),
      { label: 'migrate.scanAllItems' }
    );

    for (const item of response.Items ?? []) {
      if (typeof item.PK === 'string' && typeof item.SK === 'string') {
        items.push(item as TableItem);
      }
    }

    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL');
  }

  console.log('[migrate] Scanning DynamoDB...');
  const items = await scanAllItems();

  const players = items.filter(
    (item) => item.PK.startsWith('PLAYER#') && item.SK === 'METADATA'
  );

  const matches = items.filter(
    (item) => item.PK.startsWith('MATCH#') && item.SK === 'METADATA'
  );

  const ratings = items.filter(
    (item) => item.PK.startsWith('MATCH#') && item.SK.startsWith('RATING#')
  );

  const skippedPlayerHistories = items.filter(
    (item) => item.PK.startsWith('PLAYER#') && item.SK.startsWith('MATCH#')
  );

  console.table({
    scannedItems: items.length,
    players: players.length,
    matches: matches.length,
    ratings: ratings.length,
    skippedPlayerHistories: skippedPlayerHistories.length
  });

  const sql = neon(process.env.DATABASE_URL);
  const migratedMatchIds = new Set<string>();
  const skippedInvalidMatches: InvalidMatchDateTimeLog[] = [];

  console.log('[migrate] Importing players...');
  for (const item of players) {
    const playerId = extractPlayerIdFromPlayer(item);
    const name = stringValue(item.Name);
    const cardSeason = stringValue(item.CardSeason) || stringValue(item.Season);
    const position = stringValue(item.Position);
    const createdAt = toDbTimestamp(item.CreatedAt);
    const updatedAt = toDbTimestamp(item.UpdatedAt, createdAt);

    if (!playerId || !name || !cardSeason || !position) {
      console.warn('[migrate] Skip invalid player', { playerId, name, cardSeason, position });
      continue;
    }

    await sql`
      insert into players (
        player_id,
        name,
        normalized_name,
        card_season,
        position,
        created_at,
        updated_at
      )
      values (
        ${playerId},
        ${name},
        ${normalizePlayerName(name)},
        ${cardSeason},
        ${position},
        ${createdAt},
        ${updatedAt}
      )
      on conflict (player_id)
      do update set
        name = excluded.name,
        normalized_name = excluded.normalized_name,
        card_season = excluded.card_season,
        position = excluded.position,
        updated_at = excluded.updated_at
    `;
  }

  console.log('[migrate] Importing matches...');
  let migratedMatches = 0;

  for (const item of matches) {
    const matchId = extractMatchId(item);
    const parsedDateTime = parseMatchDateFields(item);

    if (!parsedDateTime) {
      const skipped = getInvalidMatchDateTimeLog(matchId, item);
      skippedInvalidMatches.push(skipped);
      console.warn('[migrate] skipped invalid match datetime', skipped);
      continue;
    }

    const myScore = numberValue(item.MyScore);
    const opponentScore = numberValue(item.OpponentScore);
    const createdAt = toDbTimestamp(item.CreatedAt, parsedDateTime.matchDateTime);
    const updatedAt = toDbTimestamp(item.UpdatedAt, createdAt);

    await sql`
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
        rating_version,
        created_at,
        updated_at
      )
      values (
        ${matchId},
        ${parsedDateTime.matchDate},
        ${parsedDateTime.matchTime},
        ${parsedDateTime.matchDateTime},
        ${stringValue(item.OpponentName) || null},
        ${myScore},
        ${opponentScore},
        ${normalizeResult(item.Result)},
        ${booleanValue(item.IsBigWin)},
        ${booleanValue(item.IsBigLoss)},
        ${stringValue(item.Note) || null},
        ${numberValue(item.RatingVersion)},
        ${createdAt},
        ${updatedAt}
      )
      on conflict (match_id)
      do update set
        match_date = excluded.match_date,
        match_time = excluded.match_time,
        match_datetime = excluded.match_datetime,
        opponent_name = excluded.opponent_name,
        my_score = excluded.my_score,
        opponent_score = excluded.opponent_score,
        result = excluded.result,
        is_big_win = excluded.is_big_win,
        is_big_loss = excluded.is_big_loss,
        note = excluded.note,
        rating_version = excluded.rating_version,
        updated_at = excluded.updated_at
    `;

    migratedMatchIds.add(matchId);
    migratedMatches++;
  }

  console.log('[migrate] Importing ratings...');
  let importedRatings = 0;
  let skippedRatings = 0;

  for (const item of ratings) {
    const matchId = extractMatchId(item);
    const playerId = extractPlayerIdFromRating(item);
    const rating = numberValue(item.Rating, NaN);

    if (!matchId || !playerId || !Number.isFinite(rating)) {
      skippedRatings++;
      console.warn('[migrate] Skip invalid rating', { matchId, playerId, rating });
      continue;
    }

    try {
      if (!migratedMatchIds.has(matchId)) {
        skippedRatings++;
        console.warn('[migrate] Skip rating because match was not migrated', { matchId, playerId });
        continue;
      }

      const createdAt = toDbTimestamp(item.CreatedAt);
      const updatedAt = toDbTimestamp(item.UpdatedAt, createdAt);

      await sql`
        insert into match_ratings (
          match_id,
          player_id,
          rating,
          position,
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
          ${playerId},
          ${rating},
          ${stringValue(item.Position) || null},
          ${numberValue(item.YellowCards)},
          ${numberValue(item.RedCards)},
          ${numberValue(item.Fouls)},
          ${numberValue(item.Goals)},
          ${numberValue(item.Assists)},
          ${stringValue(item.Note) || null},
          ${createdAt},
          ${updatedAt}
        )
        on conflict (match_id, player_id)
        do update set
          rating = excluded.rating,
          position = excluded.position,
          yellow_cards = excluded.yellow_cards,
          red_cards = excluded.red_cards,
          fouls = excluded.fouls,
          goals = excluded.goals,
          assists = excluded.assists,
          note = excluded.note,
          updated_at = excluded.updated_at
      `;

      importedRatings++;
    } catch (error) {
      skippedRatings++;
      console.warn('[migrate] Skip rating because insert failed', {
        matchId,
        playerId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  console.log('[migrate] Validating Neon counts...');
  const playerCount = await sql`select count(*)::int as count from players`;
  const matchCount = await sql`select count(*)::int as count from matches`;
  const ratingCount = await sql`select count(*)::int as count from match_ratings`;

  console.table({
    neonPlayers: playerCount[0].count,
    neonMatches: matchCount[0].count,
    neonRatings: ratingCount[0].count,
    migratedMatches,
    skippedInvalidMatches: skippedInvalidMatches.length,
    importedRatings,
    skippedRatings
  });

  console.log('[migrate] Summary');
  console.table({
    'Migrated matches': migratedMatches,
    'Skipped invalid matches': skippedInvalidMatches.length,
    'Migrated ratings': importedRatings
  });

  if (skippedInvalidMatches.length > 0) {
    console.warn('[migrate] Invalid match datetime records');
    console.table(skippedInvalidMatches);
  }

  console.log('[migrate] Done.');
}

main().catch((error) => {
  console.error('[migrate] Failed:', error);
  process.exitCode = 1;
});
