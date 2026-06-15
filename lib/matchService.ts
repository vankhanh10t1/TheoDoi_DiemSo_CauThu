import { BatchWriteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getDocumentClient, getTableName, formatMatchTimestamp } from './dynamodb';
import { chunkArray, retryWithBackoff } from './dynamodb-helpers';
import { getPositionGroup } from './positions';
import { sortMatchHistoryNewestFirst } from './match-history';
import { createMatchDateTime } from './match-datetime';
import type {
  Match,
  MatchResult,
  StoredMatch,
  PlayerMatchRating,
  StoredPlayerMatchRating,
  CreateMatchPayload,
  SaveMatchRatingsPayload
} from './types';

type DynamoKey = {
  PK: string;
  SK: string;
};

/**
 * Generate unique match ID
 */
function generateMatchId(): string {
  return `match_${formatMatchTimestamp()}_${crypto.randomUUID().slice(0, 8)}`;
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function mapStoredMatch(item: StoredMatch): Match {
  return {
    id: item.PK.replace(/^MATCH#/, ''),
    matchDate: item.MatchDate || item.MatchDateTime?.slice(0, 10) || item.CreatedAt?.slice(0, 10) || '',
    matchDateTime: item.MatchDateTime,
    matchTime: item.MatchTime,
    opponentName: item.OpponentName,
    myScore: item.MyScore,
    opponentScore: item.OpponentScore,
    result: item.Result,
    isBigWin: !!item.IsBigWin,
    isBigLoss: !!item.IsBigLoss,
    note: item.Note,
    ratingCount: typeof item.RatingCount === 'number' ? item.RatingCount : undefined,
    ratingVersion: typeof item.RatingVersion === 'number' ? item.RatingVersion : 0,
    createdAt: item.CreatedAt,
    updatedAt: item.UpdatedAt
  };
}

async function writeBatchedItems(tableName: string, items: unknown[]): Promise<void> {
  for (const chunk of chunkArray(items, 25)) {
    let pending = chunk;
    let attempts = 0;

    while (pending.length > 0) {
      const response = await retryWithBackoff(
        () =>
          getDocumentClient().send(
            new BatchWriteCommand({
              RequestItems: {
                [tableName]: pending.map((item) => ({ PutRequest: { Item: item as Record<string, unknown> } }))
              }
            })
          ),
        { label: 'saveMatchRatings.batchWrite' }
      );

      const unprocessed = response.UnprocessedItems?.[tableName] ?? [];
      if (unprocessed.length === 0) {
        break;
      }

      attempts++;
      if (attempts > 4) {
        throw new Error('BatchWrite returned unprocessed items after retries');
      }

      pending = unprocessed
        .map((entry) => entry.PutRequest?.Item)
        .filter((item): item is Record<string, unknown> => Boolean(item));
    }
  }
}

async function deleteBatchedKeys(tableName: string, keys: DynamoKey[]): Promise<void> {
  const uniqueKeys = Array.from(
    new Map(keys.map((key) => [`${key.PK}\u0000${key.SK}`, key])).values()
  );

  for (const chunk of chunkArray(uniqueKeys, 25)) {
    let pending = chunk.map((key) => ({ DeleteRequest: { Key: key } }));
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
        { label: 'match.deleteBatchWrite' }
      );

      const unprocessed = response.UnprocessedItems?.[tableName] ?? [];
      if (unprocessed.length === 0) {
        break;
      }

      attempts++;
      if (attempts > 4) {
        throw new Error('BatchWrite returned unprocessed delete requests after retries');
      }

      pending = unprocessed
        .map((entry) => entry.DeleteRequest)
        .filter((entry): entry is { Key: DynamoKey } => Boolean(entry?.Key))
        .map((entry) => ({ DeleteRequest: entry }));
    }
  }
}

async function queryStoredMatchRatings(matchId: string): Promise<StoredPlayerMatchRating[]> {
  const items: StoredPlayerMatchRating[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await retryWithBackoff(
      () =>
        getDocumentClient().send(
          new QueryCommand({
            TableName: getTableName(),
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :ratingPrefix)',
            ExpressionAttributeValues: {
              ':pk': `MATCH#${matchId}`,
              ':ratingPrefix': 'RATING#'
            },
            ExclusiveStartKey: exclusiveStartKey
          })
        ),
      { label: 'queryStoredMatchRatings' }
    );

    items.push(...((response.Items ?? []) as StoredPlayerMatchRating[]));
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

function toPlayerResult(result: Match['result']): MatchResult {
  if (result === 'WIN') return 'Win';
  if (result === 'DRAW') return 'Draw';
  return 'Loss';
}

function createPlayerMatchItem(
  match: Match,
  rating: StoredPlayerMatchRating,
  createdAt: string
): Record<string, unknown> {
  return {
    PK: `PLAYER#${rating.PlayerId}`,
    SK: `MATCH#${match.id}`,
    MatchId: match.id,
    MatchDateTime: match.matchDateTime,
    MatchDate: match.matchDate,
    MatchTime: match.matchTime,
    CreatedAt: createdAt,
    UpdatedAt: rating.UpdatedAt,
    Score: roundToOneDecimal(rating.Rating),
    IsStarter: true,
    Result: toPlayerResult(match.result),
    PositionGroup: getPositionGroup(rating.Position),
    DetailedPosition: rating.Position,
    YellowCards: rating.YellowCards ?? 0,
    RedCards: rating.RedCards ?? 0,
    Fouls: rating.Fouls ?? 0,
    Goals: rating.Goals ?? 0,
    Assists: rating.Assists ?? 0,
    Note: rating.Note,
    IsBigWin: !!match.isBigWin,
    IsBigLoss: !!match.isBigLoss
  };
}

async function updateMatchRatingCount(matchId: string, ratingCount: number): Promise<void> {
  const response = await getDocumentClient().send(
    new GetCommand({
      TableName: getTableName(),
      Key: { PK: `MATCH#${matchId}`, SK: 'METADATA' }
    })
  );

  if (!response.Item) {
    return;
  }

  await getDocumentClient().send(
    new UpdateCommand({
      TableName: getTableName(),
      Key: { PK: `MATCH#${matchId}`, SK: 'METADATA' },
      UpdateExpression: 'SET RatingCount = :ratingCount, UpdatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':ratingCount': ratingCount,
        ':updatedAt': formatMatchTimestamp()
      }
    })
  );
}

/**
 * Calculate match result from scores
 */
export function calculateMatchResult(myScore: number, opponentScore: number): 'WIN' | 'DRAW' | 'LOSE' {
  if (myScore > opponentScore) return 'WIN';
  if (myScore === opponentScore) return 'DRAW';
  return 'LOSE';
}

/**
 * Create a new match
 */
export async function createMatch(payload: CreateMatchPayload): Promise<Match> {
  try {
    const matchId = generateMatchId();
    const now = formatMatchTimestamp();
    const result = calculateMatchResult(payload.myScore, payload.opponentScore);
    const goalDiff = payload.myScore - payload.opponentScore;
    const isBigWin = goalDiff >= 3;
    const isBigLoss = goalDiff <= -3;

    const storedMatch: StoredMatch = {
      PK: `MATCH#${matchId}`,
      SK: 'METADATA',
      MatchDate: payload.matchDate,
      MatchDateTime: payload.matchDateTime,
      OpponentName: payload.opponentName,
      MyScore: payload.myScore,
      OpponentScore: payload.opponentScore,
      Result: result,
      IsBigWin: isBigWin,
      IsBigLoss: isBigLoss,
      Note: payload.note,
      RatingCount: 0,
      RatingVersion: 0,
      CreatedAt: now,
      UpdatedAt: now
    };

    await retryWithBackoff(
      () =>
        getDocumentClient().send(
          new PutCommand({
            TableName: getTableName(),
            Item: storedMatch
          })
        ),
      { label: 'createMatch' }
    );

    return {
      id: matchId,
      matchDate: payload.matchDate,
      matchDateTime: payload.matchDateTime,
      opponentName: payload.opponentName,
      myScore: payload.myScore,
      opponentScore: payload.opponentScore,
      result,
      isBigWin,
      isBigLoss,
      note: payload.note,
      ratingCount: 0,
      ratingVersion: 0,
      createdAt: now,
      updatedAt: now
    };
  } catch (error) {
    console.error('Error creating match:', error);
    throw new Error(`Failed to create match: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get match by ID
 */
export async function getMatchById(matchId: string): Promise<Match | null> {
  try {
    const response = await retryWithBackoff(
      () =>
        getDocumentClient().send(
          new GetCommand({
            TableName: getTableName(),
            Key: {
              PK: `MATCH#${matchId}`,
              SK: 'METADATA'
            }
          })
        ),
      { label: 'getMatchById' }
    );

    if (!response.Item) return null;

    const item = response.Item as StoredMatch;
    return mapStoredMatch(item);
  } catch (error) {
    console.error('Error getting match:', error);
    throw error;
  }
}

/**
 * List all matches (ordered by date descending)
 */
export async function listMatches(): Promise<Match[]> {
  try {
    // TODO(schema): add a match-list GSI keyed by item type and match timestamp.
    // Until then, scan only metadata fields and cap the API result to the newest 100 matches.
    const items: StoredMatch[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const response = await retryWithBackoff(
        () =>
          getDocumentClient().send(
            new ScanCommand({
              TableName: getTableName(),
              FilterExpression: 'begins_with(PK, :matchPrefix) AND SK = :metadata',
              ExpressionAttributeValues: {
                ':matchPrefix': 'MATCH#',
                ':metadata': 'METADATA'
              },
              ProjectionExpression:
                'PK, SK, #matchDate, #matchDateTime, #matchTime, #opponentName, #myScore, #opponentScore, #result, #isBigWin, #isBigLoss, #note, #ratingCount, #ratingVersion, #createdAt, #updatedAt',
              ExpressionAttributeNames: {
                '#matchDate': 'MatchDate',
                '#matchDateTime': 'MatchDateTime',
                '#matchTime': 'MatchTime',
                '#opponentName': 'OpponentName',
                '#myScore': 'MyScore',
                '#opponentScore': 'OpponentScore',
                '#result': 'Result',
                '#isBigWin': 'IsBigWin',
                '#isBigLoss': 'IsBigLoss',
                '#note': 'Note',
                '#ratingCount': 'RatingCount',
                '#ratingVersion': 'RatingVersion',
                '#createdAt': 'CreatedAt',
                '#updatedAt': 'UpdatedAt'
              },
              ExclusiveStartKey: lastEvaluatedKey
            })
          ),
        { label: 'listMatches.scan' }
      );
      items.push(...((response.Items ?? []) as StoredMatch[]));
      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    const matches = sortMatchHistoryNewestFirst(items.map(mapStoredMatch)).slice(0, 100);

    return matches;
  } catch (error) {
    console.error('Error listing matches:', error);
    throw error;
  }
}

/**
 * Update match
 */
export async function updateMatch(matchId: string, payload: Partial<CreateMatchPayload>): Promise<Match | null> {
  try {
    // First get the existing match
    const existing = await getMatchById(matchId);
    if (!existing) return null;

    const now = formatMatchTimestamp();
    const myScore = payload.myScore ?? existing.myScore;
    const opponentScore = payload.opponentScore ?? existing.opponentScore;
    const result = calculateMatchResult(myScore, opponentScore);
    const goalDiff = myScore - opponentScore;
    const isBigWin = goalDiff >= 3;
    const isBigLoss = goalDiff <= -3;

    const storedMatch: StoredMatch = {
      PK: `MATCH#${matchId}`,
      SK: 'METADATA',
      MatchDate: payload.matchDate ?? payload.matchDateTime?.slice(0, 10) ?? existing.matchDate,
      MatchDateTime:
        payload.matchDateTime ??
        (payload.matchDate ? createMatchDateTime(payload.matchDate, existing.matchTime ?? '07:00') : existing.matchDateTime),
      MatchTime: existing.matchTime,
      OpponentName: payload.opponentName ?? existing.opponentName,
      MyScore: myScore,
      OpponentScore: opponentScore,
      Result: result,
      IsBigWin: isBigWin,
      IsBigLoss: isBigLoss,
      Note: payload.note ?? existing.note,
      RatingCount: existing.ratingCount,
      RatingVersion: existing.ratingVersion,
      CreatedAt: existing.createdAt,
      UpdatedAt: now
    };

    await getDocumentClient().send(
      new PutCommand({
        TableName: getTableName(),
        Item: storedMatch,
        ConditionExpression:
          'attribute_exists(PK) AND (attribute_not_exists(RatingVersion) OR RatingVersion = :expectedVersion)',
        ExpressionAttributeValues: {
          ':expectedVersion': existing.ratingVersion ?? 0
        }
      })
    );

    const updatedMatch: Match = {
      id: matchId,
      matchDate: storedMatch.MatchDate ?? '',
      matchDateTime: storedMatch.MatchDateTime,
      matchTime: storedMatch.MatchTime,
      opponentName: storedMatch.OpponentName,
      myScore: storedMatch.MyScore,
      opponentScore: storedMatch.OpponentScore,
      result: storedMatch.Result,
      isBigWin: !!storedMatch.IsBigWin,
      isBigLoss: !!storedMatch.IsBigLoss,
      note: storedMatch.Note,
      ratingCount: storedMatch.RatingCount,
      ratingVersion: storedMatch.RatingVersion,
      createdAt: storedMatch.CreatedAt,
      updatedAt: storedMatch.UpdatedAt
    };

    const ratings = await queryStoredMatchRatings(matchId);
    if (ratings.length > 0) {
      await writeBatchedItems(
        getTableName(),
        ratings.map((rating) => createPlayerMatchItem(updatedMatch, rating, rating.CreatedAt))
      );
    }

    return updatedMatch;
  } catch (error) {
    console.error('Error updating match:', error);
    throw error;
  }
}

/**
 * Delete match (and all its ratings)
 */
export async function deleteMatch(matchId: string): Promise<boolean> {
  try {
    const ratings = await queryStoredMatchRatings(matchId);
    const keys: DynamoKey[] = [
      { PK: `MATCH#${matchId}`, SK: 'METADATA' },
      ...ratings.flatMap((rating) => [
        { PK: `MATCH#${matchId}`, SK: `RATING#${rating.PlayerId}` },
        { PK: `PLAYER#${rating.PlayerId}`, SK: `MATCH#${matchId}` }
      ])
    ];

    await deleteBatchedKeys(getTableName(), keys);

    return true;
  } catch (error) {
    console.error('Error deleting match:', error);
    throw error;
  }
}

/**
 * Save player ratings for a match (bulk operation)
 */
export async function saveMatchRatings(matchId: string, payload: SaveMatchRatingsPayload): Promise<{ created: number; updated: number }> {
  try {
    // Verify match exists
    const match = await getMatchById(matchId);
    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }

    console.info('[matchService] saveMatchRatings START', { 
      matchId, 
      matchDate: match.matchDate,
      ratingCount: payload.ratings.length,
      message: 'Saving ratings with unique per-match keys to prevent overwrites'
    });

    // Validate duplicate playerIds in payload
    const ids = payload.ratings.map((r) => r.playerId.toLowerCase());
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      throw new Error('Duplicate playerId found in ratings payload');
    }
    if (payload.ratings.length > 49) {
      throw new Error('A maximum of 49 ratings can be saved atomically per request');
    }

    const existingRatings = await getMatchRatings(matchId);
    const existingCreatedAtByPlayer = new Map(
      existingRatings.map((rating) => [rating.playerId.toLowerCase(), rating.createdAt] as const)
    );

    let created = 0;
    let updated = 0;
    const now = formatMatchTimestamp();
    const tableName = getTableName();
    const transactItems: NonNullable<ConstructorParameters<typeof TransactWriteCommand>[0]['TransactItems']> = [];

    for (const ratingData of payload.ratings) {
      const storedRating: StoredPlayerMatchRating = {
        PK: `MATCH#${matchId}`,
        SK: `RATING#${ratingData.playerId}`,
        PlayerId: ratingData.playerId,
        Rating: roundToOneDecimal(ratingData.rating),
        Position: ratingData.position,
        YellowCards: ratingData.yellowCards ?? 0,
        RedCards: ratingData.redCards ?? 0,
        Fouls: ratingData.fouls ?? 0,
        Goals: ratingData.goals,
        Assists: ratingData.assists,
        Note: ratingData.note,
        CreatedAt: existingCreatedAtByPlayer.get(ratingData.playerId.toLowerCase()) ?? now,
        UpdatedAt: now
      };
      const playerMatchItem = createPlayerMatchItem(match, storedRating, storedRating.CreatedAt);
      transactItems.push(
        { Put: { TableName: tableName, Item: storedRating } },
        { Put: { TableName: tableName, Item: playerMatchItem } }
      );

      if (existingCreatedAtByPlayer.has(ratingData.playerId.toLowerCase())) {
        updated++;
      } else {
        created++;
      }
    }

    transactItems.push({
      Update: {
        TableName: tableName,
        Key: { PK: `MATCH#${matchId}`, SK: 'METADATA' },
        UpdateExpression:
          'SET RatingCount = :ratingCount, UpdatedAt = :updatedAt, RatingVersion = if_not_exists(RatingVersion, :zero) + :one',
        ConditionExpression:
          'attribute_exists(PK) AND (attribute_not_exists(RatingVersion) OR RatingVersion = :expectedVersion)',
        ExpressionAttributeValues: {
          ':ratingCount': new Set([
            ...existingRatings.map((rating) => rating.playerId.toLowerCase()),
            ...payload.ratings.map((rating) => rating.playerId.toLowerCase())
          ]).size,
          ':updatedAt': now,
          ':zero': 0,
          ':one': 1,
          ':expectedVersion': match.ratingVersion ?? 0
        }
      }
    });

    await retryWithBackoff(
      () =>
        getDocumentClient().send(
          new TransactWriteCommand({ TransactItems: transactItems })
        ),
      { label: 'saveMatchRatings.transaction' }
    );

    console.info('[matchService] saveMatchRatings COMPLETE', { 
      matchId, 
      created, 
      updated,
      total: created + updated,
      detail: `Each rating stored with unique SK using matchId (MATCH#${matchId}) to prevent same-day overwrite bug`
    });
    return { created, updated };
  } catch (error) {
    console.error('Error saving match ratings:', error);
    throw new Error(`Failed to save match ratings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all ratings for a match
 */
export async function getMatchRatings(matchId: string): Promise<PlayerMatchRating[]> {
  try {
    const items = await queryStoredMatchRatings(matchId);
    return items.map((item) => ({
      id: `${matchId}#${item.PlayerId}`,
      matchId,
      playerId: item.PlayerId,
      rating: item.Rating,
      position: item.Position,
      yellowCards: typeof item.YellowCards === 'number' ? item.YellowCards : 0,
      redCards: typeof item.RedCards === 'number' ? item.RedCards : 0,
      fouls: typeof item.Fouls === 'number' ? item.Fouls : 0,
      goals: item.Goals,
      assists: item.Assists,
      note: item.Note,
      createdAt: item.CreatedAt,
      updatedAt: item.UpdatedAt
    }));
  } catch (error) {
    console.error('Error getting match ratings:', error);
    throw error;
  }
}

/** * Debug helper: List all rating records for a specific match
 * Useful for verifying fix: each match should have unique player-centric entries
 */
export async function debugListMatchRatings(matchId: string) {
  try {
    // List match-centric ratings (primary)
    const matchRatings = await getMatchRatings(matchId);
    
    // List player-centric ratings for all players in this match
    const playerCentricRatings: any[] = [];
    for (const rating of matchRatings) {
      const response = await getDocumentClient().send(
        new GetCommand({
          TableName: getTableName(),
          Key: {
            PK: `PLAYER#${rating.playerId}`,
            SK: `MATCH#${matchId}`
          }
        })
      );
      if (response.Item) {
        playerCentricRatings.push(response.Item);
      }
    }

    console.info('[debug] Match ratings verification', {
      matchId,
      matchCentricCount: matchRatings.length,
      playerCentricCount: playerCentricRatings.length,
      detail: 'If counts match, player-centric entries are unique per match (fix is working)'
    });

    return { matchRatings, playerCentricRatings };
  } catch (error) {
    console.error('Error in debugListMatchRatings:', error);
    throw error;
  }
}

/** * Get specific player rating for a match
 */
export async function getPlayerMatchRating(matchId: string, playerId: string): Promise<PlayerMatchRating | null> {
  try {
    const response = await getDocumentClient().send(
      new GetCommand({
        TableName: getTableName(),
        Key: {
          PK: `MATCH#${matchId}`,
          SK: `RATING#${playerId}`
        }
      })
    );

    if (!response.Item) return null;

    const item = response.Item as StoredPlayerMatchRating;
    return {
      id: `${matchId}#${playerId}`,
      matchId,
      playerId,
      rating: item.Rating,
      position: item.Position,
      yellowCards: typeof item.YellowCards === 'number' ? item.YellowCards : 0,
      redCards: typeof item.RedCards === 'number' ? item.RedCards : 0,
      fouls: typeof item.Fouls === 'number' ? item.Fouls : 0,
      goals: item.Goals,
      assists: item.Assists,
      note: item.Note,
      createdAt: item.CreatedAt,
      updatedAt: item.UpdatedAt
    };
  } catch (error) {
    console.error('Error getting player match rating:', error);
    throw error;
  }
}

/**
 * Delete a player rating from a match
 */
export async function deletePlayerMatchRating(matchId: string, playerId: string): Promise<boolean> {
  try {
    const match = await getMatchById(matchId);
    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }
    const ratings = await queryStoredMatchRatings(matchId);
    const remainingCount = ratings.filter(
      (rating) => rating.PlayerId.toLowerCase() !== playerId.toLowerCase()
    ).length;
    const tableName = getTableName();

    await retryWithBackoff(
      () =>
        getDocumentClient().send(
          new TransactWriteCommand({
            TransactItems: [
              { Delete: { TableName: tableName, Key: { PK: `MATCH#${matchId}`, SK: `RATING#${playerId}` } } },
              { Delete: { TableName: tableName, Key: { PK: `PLAYER#${playerId}`, SK: `MATCH#${matchId}` } } },
              {
                Update: {
                  TableName: tableName,
                  Key: { PK: `MATCH#${matchId}`, SK: 'METADATA' },
                  UpdateExpression:
                    'SET RatingCount = :ratingCount, UpdatedAt = :updatedAt, RatingVersion = if_not_exists(RatingVersion, :zero) + :one',
                  ConditionExpression:
                    'attribute_exists(PK) AND (attribute_not_exists(RatingVersion) OR RatingVersion = :expectedVersion)',
                  ExpressionAttributeValues: {
                    ':ratingCount': remainingCount,
                    ':updatedAt': formatMatchTimestamp(),
                    ':zero': 0,
                    ':one': 1,
                    ':expectedVersion': match.ratingVersion ?? 0
                  }
                }
              }
            ]
          })
        ),
      { label: 'deletePlayerMatchRating.transaction' }
    );
    return true;
  } catch (error) {
    console.error('Error deleting player match rating:', error);
    throw error;
  }
}

export async function resetPlayerMatchHistory(playerId: string): Promise<number> {
  const playerMatchItems: Array<{ PK: string; SK: string; MatchId?: string }> = [];
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
            ExclusiveStartKey: exclusiveStartKey
          })
        ),
      { label: 'resetPlayerMatchHistory.query' }
    );

    playerMatchItems.push(
      ...((response.Items ?? []) as Array<{ PK: string; SK: string; MatchId?: string }>)
    );
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  const matchIds = Array.from(
    new Set(
      playerMatchItems
        .map((item) => item.MatchId ?? item.SK.replace(/^MATCH#/, ''))
        .filter(Boolean)
    )
  );

  await deleteBatchedKeys(
    getTableName(),
    matchIds.flatMap((matchId) => [
      { PK: `PLAYER#${playerId}`, SK: `MATCH#${matchId}` },
      { PK: `MATCH#${matchId}`, SK: `RATING#${playerId}` }
    ])
  );

  for (const matchId of matchIds) {
    const remainingRatings = await queryStoredMatchRatings(matchId);
    await updateMatchRatingCount(matchId, remainingRatings.length);
  }

  return matchIds.length;
}

/**
 * Get match with all ratings
 */
export async function getMatchWithRatings(matchId: string): Promise<{ match: Match; ratings: PlayerMatchRating[] } | null> {
  try {
    const match = await getMatchById(matchId);
    if (!match) return null;

    const ratings = await getMatchRatings(matchId);
    return { match, ratings };
  } catch (error) {
    console.error('Error getting match with ratings:', error);
    throw error;
  }
}
