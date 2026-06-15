import { loadEnvConfig } from '@next/env';
import { BatchWriteCommand, ScanCommand, type BatchWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { getDocumentClient, getTableName } from '../lib/dynamodb';
import { chunkArray, retryWithBackoff } from '../lib/dynamodb-helpers';
import { createMatchDateTime, isValidMatchDate } from '../lib/match-datetime';
import { getMatchChronologyValue, getMatchSortTimestamp } from '../lib/match-history';
import { getPositionGroup } from '../lib/positions';
import { getPlayerNameReservationKey, normalizePlayerName } from '../lib/player-name';

loadEnvConfig(process.cwd());

type TableItem = Record<string, unknown> & { PK: string; SK: string };
type DocumentWriteRequest = NonNullable<BatchWriteCommandInput['RequestItems']>[string][number];
type IssueType =
  | 'MALFORMED_ITEM'
  | 'MISSING_MATCH'
  | 'MISSING_PLAYER'
  | 'MISSING_MATCH_RATING'
  | 'MISSING_PLAYER_HISTORY'
  | 'MISMATCHED_PLAYER_HISTORY'
  | 'MISSING_MATCH_DATETIME'
  | 'INVALID_MATCH_TIME'
  | 'DUPLICATE_RELATION'
  | 'RATING_COUNT_MISMATCH'
  | 'MISSING_NAME_RESERVATION'
  | 'DUPLICATE_NORMALIZED_NAME';

type AuditIssue = {
  type: IssueType;
  key: string;
  detail: string;
  fixable: boolean;
};

const fixMode = process.argv.includes('--fix');
const verboseMode = process.argv.includes('--verbose');
const issues: AuditIssue[] = [];
const fixes = new Map<string, TableItem>();
const loggedIssueCounts = new Map<IssueType, number>();
const DEFAULT_DETAIL_LIMIT = 10;

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function itemKey(item: Pick<TableItem, 'PK' | 'SK'>): string {
  return `${item.PK}\u0000${item.SK}`;
}

function addIssue(issue: AuditIssue): void {
  issues.push(issue);
  const loggedCount = loggedIssueCounts.get(issue.type) ?? 0;
  if (verboseMode || loggedCount < DEFAULT_DETAIL_LIMIT) {
    console.log(`[${issue.fixable ? 'FIXABLE' : 'REPORT'}] ${issue.type} ${issue.key}: ${issue.detail}`);
    loggedIssueCounts.set(issue.type, loggedCount + 1);
  } else if (loggedCount === DEFAULT_DETAIL_LIMIT) {
    console.log(`[audit:data] ${issue.type}: đã ẩn các dòng tiếp theo; dùng --verbose để xem toàn bộ.`);
    loggedIssueCounts.set(issue.type, loggedCount + 1);
  }
}

function scheduleFix(item: TableItem): void {
  fixes.set(itemKey(item), item);
}

function extractMatchId(item: TableItem): string {
  if (item.PK.startsWith('MATCH#')) return item.PK.replace(/^MATCH#/, '');
  return stringValue(item.MatchId) || item.SK.replace(/^MATCH#/, '');
}

function extractPlayerId(item: TableItem): string {
  if (item.PK.startsWith('PLAYER#')) return item.PK.replace(/^PLAYER#/, '');
  return stringValue(item.PlayerId) || item.SK.replace(/^RATING#/, '');
}

function toPlayerResult(value: unknown): 'Win' | 'Draw' | 'Loss' {
  if (value === 'WIN' || value === 'Win') return 'Win';
  if (value === 'DRAW' || value === 'Draw') return 'Draw';
  return 'Loss';
}

function buildPlayerHistory(match: TableItem, rating: TableItem): TableItem {
  const matchId = extractMatchId(match);
  const playerId = extractPlayerId(rating);

  return {
    PK: `PLAYER#${playerId}`,
    SK: `MATCH#${matchId}`,
    MatchId: matchId,
    MatchDateTime: match.MatchDateTime,
    MatchDate: match.MatchDate,
    MatchTime: match.MatchTime,
    CreatedAt: rating.CreatedAt ?? match.CreatedAt,
    UpdatedAt: rating.UpdatedAt ?? match.UpdatedAt,
    Score: rating.Rating,
    IsStarter: true,
    Result: toPlayerResult(match.Result),
    PositionGroup: getPositionGroup(stringValue(rating.Position) || undefined),
    DetailedPosition: rating.Position,
    YellowCards: rating.YellowCards ?? 0,
    RedCards: rating.RedCards ?? 0,
    Fouls: rating.Fouls ?? 0,
    Goals: rating.Goals ?? 0,
    Assists: rating.Assists ?? 0,
    Note: rating.Note,
    IsBigWin: Boolean(match.IsBigWin),
    IsBigLoss: Boolean(match.IsBigLoss)
  };
}

function buildMatchRating(history: TableItem): TableItem {
  const matchId = extractMatchId(history);
  const playerId = extractPlayerId(history);

  return {
    PK: `MATCH#${matchId}`,
    SK: `RATING#${playerId}`,
    PlayerId: playerId,
    Rating: history.Score,
    Position: history.DetailedPosition,
    YellowCards: history.YellowCards ?? 0,
    RedCards: history.RedCards ?? 0,
    Fouls: history.Fouls ?? 0,
    Goals: history.Goals ?? 0,
    Assists: history.Assists ?? 0,
    Note: history.Note,
    CreatedAt: history.CreatedAt,
    UpdatedAt: history.UpdatedAt ?? history.CreatedAt
  };
}

function historiesDiffer(expected: TableItem, actual: TableItem): boolean {
  const fields = [
    'MatchId',
    'MatchDateTime',
    'MatchDate',
    'MatchTime',
    'Score',
    'Result',
    'DetailedPosition',
    'YellowCards',
    'RedCards',
    'Fouls',
    'Goals',
    'Assists',
    'IsBigWin',
    'IsBigLoss'
  ];

  return fields.some((field) => expected[field] !== actual[field]);
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
      { label: 'audit.scanAllItems' }
    );

    for (const item of response.Items ?? []) {
      if (typeof item.PK !== 'string' || typeof item.SK !== 'string') {
        addIssue({
          type: 'MALFORMED_ITEM',
          key: JSON.stringify({ PK: item.PK, SK: item.SK }),
          detail: 'Item thiếu khóa PK/SK hợp lệ.',
          fixable: false
        });
        continue;
      }
      items.push(item as TableItem);
    }

    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

async function writeFixes(): Promise<void> {
  const tableName = getTableName();

  for (const chunk of chunkArray([...fixes.values()], 25)) {
    let pending: DocumentWriteRequest[] = chunk.map((item) => ({ PutRequest: { Item: item } }));
    let attempts = 0;

    while (pending.length > 0) {
      const response = await retryWithBackoff(
        () =>
          getDocumentClient().send(
            new BatchWriteCommand({
              RequestItems: { [tableName]: pending }
            })
          ),
        { label: 'audit.writeFixes' }
      );

      pending = response.UnprocessedItems?.[tableName] ?? [];
      attempts++;
      if (pending.length > 0 && attempts > 4) {
        throw new Error(`Không thể ghi ${pending.length} bản sửa sau nhiều lần retry.`);
      }
    }
  }
}

async function main(): Promise<void> {
  console.log(`[audit:data] Chế độ: ${fixMode ? 'FIX' : 'DRY-RUN'}`);
  console.log(`[audit:data] Bảng: ${getTableName()}`);

  const items = await scanAllItems();
  const playerMetadata = new Map<string, TableItem>();
  const nameReservations = new Map<string, TableItem>();
  const matchMetadata = new Map<string, TableItem>();
  const matchRatings = new Map<string, TableItem>();
  const playerHistories = new Map<string, TableItem>();
  const relationCounts = new Map<string, number>();

  for (const item of items) {
    if (item.PK.startsWith('PLAYER#') && item.SK === 'METADATA') {
      playerMetadata.set(extractPlayerId(item), item);
    } else if (item.PK.startsWith('PLAYER_NAME#') && item.SK === 'RESERVATION') {
      nameReservations.set(item.PK, item);
    } else if (item.PK.startsWith('MATCH#') && item.SK === 'METADATA') {
      matchMetadata.set(extractMatchId(item), item);
    } else if (item.PK.startsWith('MATCH#') && item.SK.startsWith('RATING#')) {
      const relation = `${extractMatchId(item)}\u0000${extractPlayerId(item)}`;
      matchRatings.set(relation, item);
      relationCounts.set(`rating\u0000${relation}`, (relationCounts.get(`rating\u0000${relation}`) ?? 0) + 1);
    } else if (item.PK.startsWith('PLAYER#') && item.SK.startsWith('MATCH#')) {
      const relation = `${extractMatchId(item)}\u0000${extractPlayerId(item)}`;
      playerHistories.set(relation, item);
      relationCounts.set(`history\u0000${relation}`, (relationCounts.get(`history\u0000${relation}`) ?? 0) + 1);
    }
  }

  const playersByNormalizedName = new Map<string, Array<{ playerId: string; item: TableItem }>>();
  for (const [playerId, item] of playerMetadata) {
    const name = stringValue(item.Name);
    if (!name) continue;
    const normalizedName = normalizePlayerName(name);
    const players = playersByNormalizedName.get(normalizedName) ?? [];
    players.push({ playerId, item });
    playersByNormalizedName.set(normalizedName, players);
  }

  for (const [normalizedName, players] of playersByNormalizedName) {
    if (players.length > 1) {
      addIssue({
        type: 'DUPLICATE_NORMALIZED_NAME',
        key: normalizedName,
        detail: `Có ${players.length} player cùng normalizedName; cần xử lý thủ công.`,
        fixable: false
      });
      continue;
    }

    const [{ playerId, item }] = players;
    const reservationKey = getPlayerNameReservationKey(stringValue(item.Name));
    const reservation = nameReservations.get(reservationKey.PK);
    if (!reservation || stringValue(reservation.PlayerId) !== playerId) {
      addIssue({
        type: 'MISSING_NAME_RESERVATION',
        key: playerId,
        detail: 'Thiếu reservation key để chặn tạo tên trùng đồng thời.',
        fixable: !reservation
      });
      if (!reservation) {
        scheduleFix({
          ...reservationKey,
          PlayerId: playerId,
          NormalizedName: normalizedName
        });
      }
    }
  }

  for (const [relation, count] of relationCounts) {
    if (count > 1) {
      addIssue({
        type: 'DUPLICATE_RELATION',
        key: relation.replace(/\u0000/g, '/'),
        detail: `Có ${count} bản ghi cùng matchId/playerId trong một chiều.`,
        fixable: false
      });
    }
  }

  for (const [matchId, match] of matchMetadata) {
    const rawDateTime = stringValue(match.MatchDateTime);
    const matchDate = stringValue(match.MatchDate);

    if (!rawDateTime) {
      const canBackfill = isValidMatchDate(matchDate);
      addIssue({
        type: 'MISSING_MATCH_DATETIME',
        key: `MATCH#${matchId}/METADATA`,
        detail: canBackfill ? 'Thiếu MatchDateTime; có thể backfill từ MatchDate.' : 'Thiếu MatchDateTime và MatchDate hợp lệ.',
        fixable: canBackfill
      });
      if (canBackfill) {
        const updated = { ...match, MatchDateTime: createMatchDateTime(matchDate, stringValue(match.MatchTime) || '07:00') };
        matchMetadata.set(matchId, updated);
        scheduleFix(updated);
      }
    } else if (!getMatchSortTimestamp({ matchDateTime: rawDateTime })) {
      addIssue({
        type: 'INVALID_MATCH_TIME',
        key: `MATCH#${matchId}/METADATA`,
        detail: `MatchDateTime không hợp lệ: ${rawDateTime}`,
        fixable: false
      });
    }
  }

  for (const [relation, rating] of matchRatings) {
    const [matchId, playerId] = relation.split('\u0000');
    const match = matchMetadata.get(matchId);
    const player = playerMetadata.get(playerId);
    const history = playerHistories.get(relation);

    if (!match) {
      addIssue({ type: 'MISSING_MATCH', key: relation.replace('\u0000', '/'), detail: 'Rating tham chiếu match không tồn tại.', fixable: false });
    }
    if (!player) {
      addIssue({ type: 'MISSING_PLAYER', key: relation.replace('\u0000', '/'), detail: 'Rating tham chiếu player không tồn tại.', fixable: false });
    }
    if (!history) {
      const fixable = Boolean(match && player);
      addIssue({ type: 'MISSING_PLAYER_HISTORY', key: relation.replace('\u0000', '/'), detail: 'Thiếu player-centric match history.', fixable });
      if (fixable && match) scheduleFix(buildPlayerHistory(match, rating));
    } else if (match) {
      const expected = buildPlayerHistory(match, rating);
      if (historiesDiffer(expected, history)) {
        addIssue({ type: 'MISMATCHED_PLAYER_HISTORY', key: relation.replace('\u0000', '/'), detail: 'Player history lệch dữ liệu canonical match/rating.', fixable: true });
        scheduleFix({ ...history, ...expected });
      }
    }
  }

  for (const [relation, history] of playerHistories) {
    const [matchId, playerId] = relation.split('\u0000');
    const hasMatch = matchMetadata.has(matchId);
    const hasPlayer = playerMetadata.has(playerId);

    if (!hasMatch) {
      addIssue({ type: 'MISSING_MATCH', key: relation.replace('\u0000', '/'), detail: 'Player history tham chiếu match không tồn tại.', fixable: false });
    }
    if (!hasPlayer) {
      addIssue({ type: 'MISSING_PLAYER', key: relation.replace('\u0000', '/'), detail: 'Player history tham chiếu player không tồn tại.', fixable: false });
    }
    if (!matchRatings.has(relation)) {
      const fixable = hasMatch && hasPlayer && numberValue(history.Score) !== undefined;
      addIssue({ type: 'MISSING_MATCH_RATING', key: relation.replace('\u0000', '/'), detail: 'Thiếu match-centric rating.', fixable });
      if (fixable) scheduleFix(buildMatchRating(history));
    }

    if (!getMatchChronologyValue({
      sk: history.SK,
      matchDateTime: stringValue(history.MatchDateTime) || undefined,
      matchDate: stringValue(history.MatchDate) || undefined,
      matchTime: stringValue(history.MatchTime) || undefined,
      createdAt: stringValue(history.CreatedAt) || undefined,
      updatedAt: stringValue(history.UpdatedAt) || undefined,
      score: numberValue(history.Score) ?? 0,
      result: toPlayerResult(history.Result)
    })) {
      addIssue({ type: 'INVALID_MATCH_TIME', key: relation.replace('\u0000', '/'), detail: 'Player history không có thời gian hợp lệ.', fixable: false });
    }
  }

  for (const [matchId, match] of matchMetadata) {
    const actualCount = [...matchRatings.keys()].filter((relation) => relation.startsWith(`${matchId}\u0000`)).length;
    const storedCount = numberValue(match.RatingCount);
    if (storedCount !== actualCount) {
      addIssue({
        type: 'RATING_COUNT_MISMATCH',
        key: `MATCH#${matchId}/METADATA`,
        detail: `RatingCount=${storedCount ?? 'missing'}, thực tế=${actualCount}.`,
        fixable: true
      });
      scheduleFix({ ...match, RatingCount: actualCount });
    }
  }

  const summary = issues.reduce<Record<string, number>>((result, issue) => {
    result[issue.type] = (result[issue.type] ?? 0) + 1;
    return result;
  }, {});

  console.log('\n[audit:data] Summary');
  console.table({
    scannedItems: items.length,
    players: playerMetadata.size,
    matches: matchMetadata.size,
    matchRatings: matchRatings.size,
    playerHistories: playerHistories.size,
    issues: issues.length,
    fixableIssues: issues.filter((issue) => issue.fixable).length,
    scheduledWrites: fixes.size
  });
  console.table(summary);

  if (!fixMode) {
    console.log('[audit:data] Dry-run hoàn tất. Chạy `npm run audit:data -- --fix` để áp dụng các sửa chữa an toàn.');
    return;
  }

  await writeFixes();
  console.log(`[audit:data] Đã ghi ${fixes.size} bản sửa. Không có dữ liệu nào bị xóa.`);
}

main().catch((error) => {
  console.error('[audit:data] Thất bại:', error);
  process.exitCode = 1;
});
