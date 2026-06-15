import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { NextResponse } from 'next/server';
import { getDocumentClient, getTableName } from '../../../lib/dynamodb';
import { isDynamoThrottleError, retryWithBackoff } from '../../../lib/dynamodb-helpers';
import { buildRecommendationsFromTableItems } from '../../../lib/recommendationService';

export const runtime = 'nodejs';

type RecommendationTableItem = Record<string, unknown>;

async function scanAllTableItems(): Promise<RecommendationTableItem[]> {
  // TODO(schema): add a player-history GSI or materialized recommendation view.
  // A filtered scan is retained for backward compatibility with legacy player-history keys.
  const items: RecommendationTableItem[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await retryWithBackoff(
      () =>
        getDocumentClient().send(
          new ScanCommand({
            TableName: getTableName(),
            FilterExpression: 'begins_with(PK, :playerPrefix)',
            ExpressionAttributeValues: {
              ':playerPrefix': 'PLAYER#'
            },
            ProjectionExpression:
              'PK, SK, #name, #cardSeason, #season, #position, #score, #result, #matchId, #matchDateTime, #matchDate, #matchTime, #createdAt, #updatedAt, #yellowCards, #redCards, #fouls',
            ExpressionAttributeNames: {
              '#name': 'Name',
              '#cardSeason': 'CardSeason',
              '#season': 'Season',
              '#position': 'Position',
              '#score': 'Score',
              '#result': 'Result',
              '#matchId': 'MatchId',
              '#matchDateTime': 'MatchDateTime',
              '#matchDate': 'MatchDate',
              '#matchTime': 'MatchTime',
              '#createdAt': 'CreatedAt',
              '#updatedAt': 'UpdatedAt',
              '#yellowCards': 'YellowCards',
              '#redCards': 'RedCards',
              '#fouls': 'Fouls'
            },
            ExclusiveStartKey: exclusiveStartKey
          })
        ),
      { label: 'recommendations.scanAllTableItems' }
    );

    items.push(...((response.Items ?? []) as RecommendationTableItem[]));
    exclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  return items;
}

export async function GET() {
  try {
    const tableItems = await scanAllTableItems();
    const ranked = buildRecommendationsFromTableItems(tableItems);

    return NextResponse.json(
      { recommendations: ranked, totalCount: ranked.length },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/recommendations:', error);
    const throttled = isDynamoThrottleError(error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: throttled
          ? 'DynamoDB đang bị giới hạn đọc. Vui lòng thử lại sau vài giây.'
          : 'Không thể tải danh sách đề xuất.',
        code: throttled ? 'DYNAMODB_THROTTLED' : 'INTERNAL_ERROR',
        ...(process.env.NODE_ENV === 'development' ? { detail: errorMessage } : {})
      },
      { status: throttled ? 429 : 500 }
    );
  }
}
