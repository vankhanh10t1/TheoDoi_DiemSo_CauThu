import { GetCommand, PutCommand, QueryCommand, DeleteCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getDocumentClient, getTableName, formatMatchTimestamp } from './dynamodb';
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

    await getDocumentClient().send(
      new PutCommand({
        TableName: getTableName(),
        Item: storedMatch
      })
    );

    return {
      id: matchId,
      matchDate: payload.matchDate,
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
    const response = await getDocumentClient().send(
      new GetCommand({
        TableName: getTableName(),
        Key: {
          PK: `MATCH#${matchId}`,
          SK: 'METADATA'
        }
      })
    );

    if (!response.Item) return null;

    const item = response.Item as StoredMatch;
    return {
      id: matchId,
      matchDate: item.MatchDate,
      opponentName: item.OpponentName,
      myScore: item.MyScore,
      opponentScore: item.OpponentScore,
      result: item.Result,
      isBigWin: !!item.IsBigWin,
      isBigLoss: !!item.IsBigLoss,
      note: item.Note,
      createdAt: item.CreatedAt,
      updatedAt: item.UpdatedAt
    };
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
    // Since we're using a generic table, we need to scan all MATCH# items with SK=METADATA
    // A more efficient approach would use a GSI, but for now we'll scan
    const response = await getDocumentClient().send(
      new ScanCommand({
        TableName: getTableName(),
        FilterExpression: 'begins_with(PK, :matchPrefix) AND SK = :metadata',
        ExpressionAttributeValues: {
          ':matchPrefix': 'MATCH#',
          ':metadata': 'METADATA'
        }
      })
    );

    const items = (response.Items ?? []) as StoredMatch[];
    
    // Extract match IDs from PK and sort by date descending
    const matches = items
      .map((item) => {
        const matchId = item.PK.replace(/^MATCH#/, '');
        return {
          id: matchId,
          matchDate: item.MatchDate,
          opponentName: item.OpponentName,
          myScore: item.MyScore,
          opponentScore: item.OpponentScore,
          result: item.Result,
          isBigWin: !!item.IsBigWin,
          isBigLoss: !!item.IsBigLoss,
          note: item.Note,
          createdAt: item.CreatedAt,
          updatedAt: item.UpdatedAt
        } as Match;
      })
      .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());

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
      MatchDate: payload.matchDate ?? existing.matchDate,
      OpponentName: payload.opponentName ?? existing.opponentName,
      MyScore: myScore,
      OpponentScore: opponentScore,
      Result: result,
      IsBigWin: isBigWin,
      IsBigLoss: isBigLoss,
      Note: payload.note ?? existing.note,
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
      matchDate: storedMatch.MatchDate,
      opponentName: storedMatch.OpponentName,
      myScore: storedMatch.MyScore,
      opponentScore: storedMatch.OpponentScore,
      result: storedMatch.Result,
      isBigWin: !!storedMatch.IsBigWin,
      isBigLoss: !!storedMatch.IsBigLoss,
      note: storedMatch.Note,
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

    // Validate duplicate playerIds in payload
    const ids = payload.ratings.map((r) => r.playerId.toLowerCase());
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      throw new Error('Duplicate playerId found in ratings payload');
    }

    let created = 0;
    let updated = 0;
    const now = formatMatchTimestamp();

    for (const ratingData of payload.ratings) {
      const existingRating = await getPlayerMatchRating(matchId, ratingData.playerId);
      
      const storedRating: StoredPlayerMatchRating = {
        PK: `MATCH#${matchId}`,
        SK: `RATING#${ratingData.playerId}`,
        PlayerId: ratingData.playerId,
        Rating: ratingData.rating,
        Position: ratingData.position,
        Goals: ratingData.goals,
        Assists: ratingData.assists,
        Note: ratingData.note,
        CreatedAt: existingRating?.createdAt ?? now,
        UpdatedAt: now
      };

      await getDocumentClient().send(
        new PutCommand({
          TableName: getTableName(),
          Item: storedRating
        })
      );

      if (existingRating) {
        updated++;
      } else {
        created++;
      }
    }

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
    const response = await getDocumentClient().send(
      new QueryCommand({
        TableName: getTableName(),
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :ratingPrefix)',
        ExpressionAttributeValues: {
          ':pk': `MATCH#${matchId}`,
          ':ratingPrefix': 'RATING#'
        }
      })
    );

    const items = (response.Items ?? []) as StoredPlayerMatchRating[];
    return items.map((item) => ({
      id: `${matchId}#${item.PlayerId}`,
      matchId,
      playerId: item.PlayerId,
      rating: item.Rating,
      position: item.Position,
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

/**
 * Get specific player rating for a match
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
