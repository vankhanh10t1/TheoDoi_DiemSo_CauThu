import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { NextResponse } from 'next/server';
import { getDocumentClient, getTableName } from '../../../lib/dynamodb';
import { isDynamoThrottleError, retryWithBackoff } from '../../../lib/dynamodb-helpers';
import { buildRecommendationsFromTableItems } from '../../../lib/recommendationService';

export const runtime = 'nodejs';

type RecommendationTableItem = Record<string, unknown>;

async function scanAllTableItems(): Promise<RecommendationTableItem[]> {
  const items: RecommendationTableItem[] = [];
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
  } catch {
    return NextResponse.json({ recommendations: [], totalCount: 0 }, { status: 200 });
  }
}
