import { GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getDocumentClient, getTableName } from './dynamodb';
import { retryWithBackoff } from './dynamodb-helpers';
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
  const queryInput = {
    TableName: getTableName(),
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :matchPrefix)',
    ExpressionAttributeValues: {
      ':pk': `PLAYER#${playerId}`,
      ':matchPrefix': 'MATCH#'
    },
    ScanIndexForward: false,
    ...(typeof limit === 'number' ? { Limit: limit } : {})
  };

  const response = await retryWithBackoff(() => getDocumentClient().send(new QueryCommand(queryInput)), {
    label: 'getRecentMatches'
  });

  return (response.Items ?? []).map((item): RecentMatch => {
    const match = item as StoredMatchItem;
    const positionGroup = isPositionGroup(match.PositionGroup) ? match.PositionGroup : undefined;
    const detailedPosition =
      positionGroup && isDetailedPositionForGroup(positionGroup, match.DetailedPosition)
        ? match.DetailedPosition
        : undefined;

    return {
      sk: match.SK,
      score: match.Score,
      result: match.Result,
      positionGroup,
      detailedPosition,
      yellowCards: typeof match.YellowCards === 'number' ? match.YellowCards : 0,
      redCards: typeof match.RedCards === 'number' ? match.RedCards : 0,
      fouls: typeof match.Fouls === 'number' ? match.Fouls : 0,
      isBigWin: typeof match.IsBigWin === 'boolean' ? match.IsBigWin : false,
      isBigLoss: typeof match.IsBigLoss === 'boolean' ? match.IsBigLoss : false
    };
  });
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