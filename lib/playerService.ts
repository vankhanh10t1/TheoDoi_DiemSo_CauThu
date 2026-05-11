import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getDocumentClient, getTableName } from './dynamodb';
import type { PlayerMetadataItem, PlayerSummary, RecentMatch, StoredMatchItem } from './types';

function toPlayerIdFromPk(pk: string): string {
  return pk.replace(/^PLAYER#/, '');
}

function mapMetadataItem(item: PlayerMetadataItem): PlayerSummary {
  return {
    playerId: toPlayerIdFromPk(item.PK),
    name: item.Name,
    season: item.Season,
    position: item.Position
  };
}

export async function listPlayers(): Promise<PlayerSummary[]> {
  try {
    const response = await getDocumentClient().send(
      new QueryCommand({
        TableName: getTableName(),
        KeyConditionExpression: 'PK = PK',
        // DynamoDB doesn't allow querying without a proper key; fall back to Scan
      })
    );

    // If Query above isn't applicable, fall back to Scan for METADATA
  } catch {
    // ignore and continue to Scan below
  }

  try {
    const resp = await getDocumentClient().send(
      new (await import('@aws-sdk/lib-dynamodb')).ScanCommand({
        TableName: getTableName(),
        FilterExpression: 'SK = :metadata',
        ExpressionAttributeValues: {
          ':metadata': 'METADATA'
        }
      })
    );

    const items = (resp.Items ?? []) as PlayerMetadataItem[];
    return items.map(mapMetadataItem);
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

  const response = await getDocumentClient().send(new QueryCommand(queryInput));

  return (response.Items ?? []).map((item): RecentMatch => {
    const match = item as StoredMatchItem;
    return {
      sk: match.SK,
      score: match.Score,
      result: match.Result
    };
  });
}