import { BatchWriteCommand, GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getDocumentClient, getTableName } from './dynamodb';
import { chunkArray, retryWithBackoff } from './dynamodb-helpers';
import { sortRecentMatchesNewestFirst } from './match-history';
import { isDetailedPositionForGroup, isPositionGroup } from './positions';
import type { PlayerMetadataItem, PlayerSummary, RecentMatch, StoredMatchItem } from './types';

function toPlayerIdFromPk(pk: string): string {
  return pk.replace(/^PLAYER#/, '');
}

function mapMetadataItem(item: PlayerMetadataItem): PlayerSummary {
  return {
    playerId: toPlayerIdFromPk(item.PK),
    name: item.Name,
    cardSeason: item.CardSeason ?? (item as any).Season ?? '', // Support both new and legacy field names
    position: item.Position
  };
}

export async function listPlayers(): Promise<PlayerSummary[]> {
  try {
    const listIndexName = process.env.DYNAMODB_LIST_INDEX_NAME?.trim();

    if (listIndexName) {
      try {
        const indexed = await retryWithBackoff(
          () =>
            getDocumentClient().send(
              new QueryCommand({
                TableName: getTableName(),
                IndexName: listIndexName,
                KeyConditionExpression: 'SK = :metadata',
                ExpressionAttributeValues: {
                  ':metadata': 'METADATA'
                }
              })
            ),
          { label: 'listPlayers.queryIndex' }
        );

        const indexedItems = (indexed.Items ?? []) as PlayerMetadataItem[];
        return indexedItems
          .filter((item) => typeof item.PK === 'string' && item.PK.startsWith('PLAYER#'))
          .map(mapMetadataItem)
          .filter((player) => player.playerId.trim().length > 0 && player.name.trim().length > 0);
      } catch (error) {
        console.warn('[playerService] listPlayers index query failed, falling back to scan', {
          error: error instanceof Error ? error.message : String(error),
          indexName: listIndexName
        });
      }
    }

    const resp = await retryWithBackoff(
      () =>
        getDocumentClient().send(
          new ScanCommand({
            TableName: getTableName(),
            FilterExpression: 'SK = :metadata',
            ExpressionAttributeValues: {
              ':metadata': 'METADATA'
            }
          })
        ),
      { label: 'listPlayers.scan' }
    );

    const items = (resp.Items ?? []) as PlayerMetadataItem[];
    return items
      .filter((item) => typeof item.PK === 'string' && item.PK.startsWith('PLAYER#'))
      .map(mapMetadataItem)
      .filter((player) => player.playerId.trim().length > 0 && player.name.trim().length > 0);
  } catch {
    // If DynamoDB is unavailable or table not present, return empty list
    return [];
  }
}

export async function getPlayerMetadata(playerId: string): Promise<PlayerSummary | null> {
  try {
    const response = await getDocumentClient().send(
      new GetCommand({
        TableName: getTableName(),
        Key: {
          PK: `PLAYER#${playerId}`,
          SK: 'METADATA'
        }
      })
    );

    if (!response.Item) return null;

    return mapMetadataItem(response.Item as PlayerMetadataItem);
  } catch {
    return null;
  }
}

export async function getRecentMatches(playerId: string, limit?: number): Promise<RecentMatch[]> {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await retryWithBackoff(
      () =>
        getDocumentClient().send(
          new QueryCommand({
            TableName: getTableName(),
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :matchPrefix)',
            ExpressionAttributeValues: {
              ':pk': `PLAYER#${playerId}`,
              ':matchPrefix': 'MATCH#'
            },
            ScanIndexForward: false,
            ExclusiveStartKey: exclusiveStartKey
          })
        ),
      { label: 'getRecentMatches' }
    );

    items.push(...((response.Items ?? []) as Record<string, unknown>[]));
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  const matches = items.map((item): RecentMatch => {
    const match = item as unknown as StoredMatchItem;
    const positionGroup = isPositionGroup(match.PositionGroup) ? match.PositionGroup : undefined;
    const detailedPosition =
      positionGroup && isDetailedPositionForGroup(positionGroup, match.DetailedPosition)
        ? match.DetailedPosition
        : undefined;

    return {
      sk: match.SK,
      matchId: match.MatchId ?? match.SK.replace(/^MATCH#/, ''),
      matchDateTime: match.MatchDateTime,
      matchDate: match.MatchDate,
      matchTime: match.MatchTime,
      createdAt: match.CreatedAt,
      score: match.Score,
      result: match.Result,
      positionGroup,
      detailedPosition,
      yellowCards: typeof match.YellowCards === 'number' ? match.YellowCards : 0,
      redCards: typeof match.RedCards === 'number' ? match.RedCards : 0,
      fouls: typeof match.Fouls === 'number' ? match.Fouls : 0,
      goals: typeof match.Goals === 'number' ? match.Goals : 0,
      assists: typeof match.Assists === 'number' ? match.Assists : 0,
      note: typeof match.Note === 'string' ? match.Note : undefined,
      isBigWin: typeof match.IsBigWin === 'boolean' ? match.IsBigWin : false,
      isBigLoss: typeof match.IsBigLoss === 'boolean' ? match.IsBigLoss : false
    };
  });

  const sortedMatches = sortRecentMatchesNewestFirst(matches).filter(
    (match) => Number.isFinite(match.score)
  );
  return typeof limit === 'number' ? sortedMatches.slice(0, limit) : sortedMatches;
}

export async function deletePlayersAndRelatedData(playerIds: string[]): Promise<DeletePlayersResult> {
  const uniquePlayerIds = uniqueTrimmedPlayerIds(playerIds);

  if (uniquePlayerIds.length === 0) {
    return {
      requestedCount: 0,
      deletedPlayerIds: [],
      deletedItemCount: 0
    };
  }

  const allKeys: DynamoKey[] = [];

  for (const playerId of uniquePlayerIds) {
    const [playerItemKeys, matchRatingKeys] = await Promise.all([
      queryAllPlayerKeys(playerId),
      scanAllMatchRatingKeys(playerId)
    ]);

    allKeys.push(...playerItemKeys, ...matchRatingKeys);
  }

  const deletedItemCount = await deleteKeysInBatches(allKeys);

  return {
    requestedCount: uniquePlayerIds.length,
    deletedPlayerIds: uniquePlayerIds,
    deletedItemCount
  };
}

/**
 * Normalize player name for duplicate checking (trim spaces, lowercase)
 */
export function normalizePlayerName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Check if a player with the same name already exists (case-insensitive, trimmed)
 * Returns the existing player's ID if found, null otherwise
 */
export async function findDuplicatePlayerByName(
  playerName: string,
  excludePlayerId?: string
): Promise<string | null> {
  try {
    const allPlayers = await listPlayers();
    const normalizedNewName = normalizePlayerName(playerName);

    for (const player of allPlayers) {
      // Skip the player being edited (if excludePlayerId is provided)
      if (excludePlayerId && player.playerId === excludePlayerId) {
        continue;
      }

      const normalizedExistingName = normalizePlayerName(player.name);
      if (normalizedExistingName === normalizedNewName) {
        return player.playerId;
      }
    }

    return null;
  } catch (error) {
    console.error('Error checking for duplicate player names:', error);
    throw error;
  }
}

type DynamoKey = {
  PK: string;
  SK: string;
};

export type DeletePlayersResult = {
  requestedCount: number;
  deletedPlayerIds: string[];
  deletedItemCount: number;
};

function uniqueTrimmedPlayerIds(playerIds: string[]): string[] {
  const seen = new Set<string>();
  const uniqueIds: string[] = [];

  for (const rawId of playerIds) {
    const playerId = rawId.trim();
    if (!playerId || seen.has(playerId)) {
      continue;
    }

    seen.add(playerId);
    uniqueIds.push(playerId);
  }

  return uniqueIds;
}

async function queryAllPlayerKeys(playerId: string): Promise<DynamoKey[]> {
  const keys: DynamoKey[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await retryWithBackoff(
      () =>
        getDocumentClient().send(
          new QueryCommand({
            TableName: getTableName(),
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: {
              ':pk': `PLAYER#${playerId}`
            },
            ExclusiveStartKey: exclusiveStartKey
          })
        ),
      { label: 'player.deleteQueryPlayerItems' }
    );

    for (const item of response.Items ?? []) {
      if (typeof item.PK === 'string' && typeof item.SK === 'string') {
        keys.push({ PK: item.PK, SK: item.SK });
      }
    }

    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return keys;
}

async function scanAllMatchRatingKeys(playerId: string): Promise<DynamoKey[]> {
  const keys: DynamoKey[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await retryWithBackoff(
      () =>
        getDocumentClient().send(
          new ScanCommand({
            TableName: getTableName(),
            FilterExpression: 'begins_with(PK, :matchPrefix) AND SK = :ratingKey',
            ExpressionAttributeValues: {
              ':matchPrefix': 'MATCH#',
              ':ratingKey': `RATING#${playerId}`
            },
            ExclusiveStartKey: exclusiveStartKey
          })
        ),
      { label: 'player.deleteScanMatchRatings' }
    );

    for (const item of response.Items ?? []) {
      if (typeof item.PK === 'string' && typeof item.SK === 'string') {
        keys.push({ PK: item.PK, SK: item.SK });
      }
    }

    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return keys;
}

async function deleteKeysInBatches(keys: DynamoKey[]): Promise<number> {
  const uniqueKeys = Array.from(
    new Map(keys.map((key) => [`${key.PK}\u0000${key.SK}`, key])).values()
  );
  const tableName = getTableName();
  let deletedCount = 0;

  for (const chunk of chunkArray(uniqueKeys, 25)) {
    let pending = chunk.map((key) => ({
      DeleteRequest: {
        Key: key
      }
    }));
    let attempts = 0;

    while (pending.length > 0) {
      const response = await retryWithBackoff(
        () =>
          getDocumentClient().send(
            new BatchWriteCommand({
              RequestItems: {
                [tableName]: pending
              }
            })
          ),
        { label: 'player.deleteBatchWrite' }
      );

      const unprocessed = response.UnprocessedItems?.[tableName] ?? [];
      deletedCount += pending.length - unprocessed.length;

      if (unprocessed.length === 0) {
        break;
      }

      attempts++;
      if (attempts > 4) {
        throw new Error('DynamoDB is still busy. Some delete requests were not processed.');
      }

      pending = unprocessed
        .map((entry) => entry.DeleteRequest)
        .filter((entry): entry is { Key: DynamoKey } => Boolean(entry?.Key))
        .map((entry) => ({ DeleteRequest: entry }));
    }
  }

  return deletedCount;
}
