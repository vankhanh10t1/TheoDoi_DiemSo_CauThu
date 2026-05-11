import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { NextResponse } from 'next/server';
import { getDocumentClient, getTableName } from '../../../lib/dynamodb';
import { generateTransferRecommendation, rankTransferRecommendations } from '../../../lib/transferEngine';
import type { StoredMatchItem } from '../../../lib/types';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // Get all METADATA items to find all players
    const metadataResponse = await getDocumentClient().send(
      new ScanCommand({
        TableName: getTableName(),
        FilterExpression: 'SK = :metadata',
        ExpressionAttributeValues: {
          ':metadata': 'METADATA'
        }
      })
    );

    const metadataItems = metadataResponse.Items ?? [];
    const recommendations = [];

    // For each player, get their recent matches and generate recommendation
    for (const metadataItem of metadataItems) {
      const playerId = (metadataItem.PK as string).replace(/^PLAYER#/, '');
      const playerName = metadataItem.Name as string;

      try {
        const matchResponse = await getDocumentClient().send(
          new ScanCommand({
            TableName: getTableName(),
            FilterExpression: 'PK = :pk AND begins_with(SK, :matchPrefix)',
            ExpressionAttributeValues: {
              ':pk': `PLAYER#${playerId}`,
              ':matchPrefix': 'MATCH#'
            }
          })
        );

        const matches = (matchResponse.Items ?? []) as StoredMatchItem[];
        const allMatches = matches
          .sort((a, b) => (b.SK > a.SK ? 1 : -1))
          .map((m) => ({
            sk: m.SK,
            score: m.Score,
            result: m.Result
          }));
        const recentMatches = allMatches.slice(0, 5);

        const rec = generateTransferRecommendation(playerId, playerName, recentMatches);
        if (rec) {
          rec.matchCount = allMatches.length;
          recommendations.push(rec);
        }
      } catch {
        // Skip if error fetching matches
      }
    }

    const ranked = rankTransferRecommendations(recommendations);

    return NextResponse.json(
      { recommendations: ranked, totalCount: ranked.length },
      { status: 200 }
    );
  } catch {
    // Fallback: no players available
    const fallbackRecs: any[] = [];

    return NextResponse.json(
      { recommendations: rankTransferRecommendations(fallbackRecs), totalCount: fallbackRecs.length },
      { status: 200 }
    );
  }
}
