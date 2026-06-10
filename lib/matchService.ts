import { BatchWriteCommand, DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getDocumentClient, getTableName, formatMatchTimestamp, createMatchSortKey } from './dynamodb';
import { chunkArray, retryWithBackoff } from './dynamodb-helpers';
import { getPositionGroup } from './positions';
import { sortMatchHistoryNewestFirst } from './match-history';
import type {
  Match,
  StoredMatch,
  PlayerMatchRating,
  StoredPlayerMatchRating,
  CreateMatchPayload,
  SaveMatchRatingsPayload
} from './types';

/**
 * Generate unique match ID
 */
function generateMatchId(): string {
  return `match_${formatMatchTimestamp()}`;
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
    return null;
  }
}

/**
 * List all matches (ordered by date descending)
 */
export async function listMatches(): Promise<Match[]> {
  try {
    const items: StoredMatch[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const response = await getDocumentClient().send(
        new ScanCommand({
          TableName: getTableName(),
          FilterExpression: 'begins_with(PK, :matchPrefix) AND SK = :metadata',
          ExpressionAttributeValues: {
            ':matchPrefix': 'MATCH#',
            ':metadata': 'METADATA'
          },
          ExclusiveStartKey: lastEvaluatedKey
        })
      );
      items.push(...((response.Items ?? []) as StoredMatch[]));
      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    const matches = sortMatchHistoryNewestFirst(items.map(mapStoredMatch)).slice(0, 100);

    return matches;
  } catch (error) {
    console.error('Error listing matches:', error);
    return [];
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
      MatchDateTime: payload.matchDateTime ?? existing.matchDateTime,
      MatchTime: existing.matchTime,
      OpponentName: payload.opponentName ?? existing.opponentName,
      MyScore: myScore,
      OpponentScore: opponentScore,
      Result: result,
      IsBigWin: isBigWin,
      IsBigLoss: isBigLoss,
      Note: payload.note ?? existing.note,
      RatingCount: existing.ratingCount,
      CreatedAt: existing.createdAt,
      UpdatedAt: now
    };

    await getDocumentClient().send(
      new PutCommand({
        TableName: getTableName(),
        Item: storedMatch
      })
    );

    return {
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
      createdAt: storedMatch.CreatedAt,
      updatedAt: storedMatch.UpdatedAt
    };
  } catch (error) {
    console.error('Error updating match:', error);
    return null;
  }
}

/**
 * Delete match (and all its ratings)
 */
export async function deleteMatch(matchId: string): Promise<boolean> {
  try {
    // Delete match metadata
    await getDocumentClient().send(
      new DeleteCommand({
        TableName: getTableName(),
        Key: {
          PK: `MATCH#${matchId}`,
          SK: 'METADATA'
        }
      })
    );

    // Delete all ratings for this match
    const ratings = await getMatchRatings(matchId);
    for (const rating of ratings) {
      await getDocumentClient().send(
        new DeleteCommand({
          TableName: getTableName(),
          Key: {
            PK: `MATCH#${matchId}`,
            SK: `RATING#${rating.playerId}`
          }
        })
      );
    }

    return true;
  } catch (error) {
    console.error('Error deleting match:', error);
    return false;
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

    const existingRatings = await getMatchRatings(matchId);
    const existingCreatedAtByPlayer = new Map(
      existingRatings.map((rating) => [rating.playerId.toLowerCase(), rating.createdAt] as const)
    );

    let created = 0;
    let updated = 0;
    const now = formatMatchTimestamp();
    const tableName = getTableName();
    const writeItems: unknown[] = [];

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
      writeItems.push(storedRating);

      // Also write per-player match entry for quick player-centric queries
      try {
        // Use matchId in SK to ensure uniqueness per match (fixes bug where same-day matches overwrite each other)
        const playerSk = `MATCH#${matchId}`;
        const playerResultMap: Record<string, 'Win' | 'Draw' | 'Loss'> = {
          WIN: 'Win',
          DRAW: 'Draw',
          LOSE: 'Loss'
        };

        const playerMatchItem: Record<string, unknown> = {
          PK: `PLAYER#${ratingData.playerId}`,
          SK: playerSk,
          MatchDate: match.matchDateTime ?? match.matchDate,
          CreatedAt: now,
          Score: roundToOneDecimal(ratingData.rating),
          IsStarter: true,
          Result: playerResultMap[(match.result as string) ?? 'LOSE'],
          PositionGroup: getPositionGroup(ratingData.position) ?? undefined,
          DetailedPosition: ratingData.position,
          YellowCards: ratingData.yellowCards ?? 0,
          RedCards: ratingData.redCards ?? 0,
          Fouls: ratingData.fouls ?? 0,
          IsBigWin: !!match.isBigWin,
          IsBigLoss: !!match.isBigLoss
        };

        writeItems.push(playerMatchItem);

        console.debug('[matchService] wrote player-centric match item', { 
          PK: playerMatchItem.PK, 
          SK: playerMatchItem.SK,
          matchId: matchId,
          playerId: ratingData.playerId,
          rating: playerMatchItem.Score,
          detail: `Unique key: PK=${playerMatchItem.PK}, SK=${playerMatchItem.SK} ensures no overwrites for same-day matches`
        });
      } catch (err) {
        console.error('Failed to write player-centric match item:', err);
      }

      if (existingCreatedAtByPlayer.has(ratingData.playerId.toLowerCase())) {
        updated++;
      } else {
        created++;
      }
    }

    await writeBatchedItems(tableName, writeItems);

    await retryWithBackoff(
      () =>
        getDocumentClient().send(
          new UpdateCommand({
            TableName: tableName,
            Key: { PK: `MATCH#${matchId}`, SK: 'METADATA' },
            UpdateExpression: 'SET RatingCount = :ratingCount, UpdatedAt = :updatedAt',
            ExpressionAttributeValues: {
              ':ratingCount': new Set([
                ...existingRatings.map((rating) => rating.playerId.toLowerCase()),
                ...payload.ratings.map((rating) => rating.playerId.toLowerCase())
              ]).size,
              ':updatedAt': now
            }
          })
        ),
      { label: 'saveMatchRatings.updateMatchCount' }
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
    const response = await retryWithBackoff(
      () =>
        getDocumentClient().send(
          new QueryCommand({
            TableName: getTableName(),
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :ratingPrefix)',
            ExpressionAttributeValues: {
              ':pk': `MATCH#${matchId}`,
              ':ratingPrefix': 'RATING#'
            }
          })
        ),
      { label: 'getMatchRatings' }
    );

    const items = (response.Items ?? []) as StoredPlayerMatchRating[];
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
    return [];
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
    return null;
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
    return null;
  }
}

/**
 * Delete a player rating from a match
 */
export async function deletePlayerMatchRating(matchId: string, playerId: string): Promise<boolean> {
  try {
    await getDocumentClient().send(
      new DeleteCommand({
        TableName: getTableName(),
        Key: {
          PK: `MATCH#${matchId}`,
          SK: `RATING#${playerId}`
        }
      })
    );

    const remainingRatings = await getMatchRatings(matchId);
    await getDocumentClient().send(
      new UpdateCommand({
        TableName: getTableName(),
        Key: { PK: `MATCH#${matchId}`, SK: 'METADATA' },
        UpdateExpression: 'SET RatingCount = :ratingCount, UpdatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':ratingCount': remainingRatings.length,
          ':updatedAt': formatMatchTimestamp()
        }
      })
    );
    return true;
  } catch (error) {
    console.error('Error deleting player match rating:', error);
    return false;
  }
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
    return null;
  }
}
