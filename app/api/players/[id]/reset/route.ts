import { QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { NextRequest, NextResponse } from 'next/server';
import { getDocumentClient, getTableName } from '../../../../../lib/dynamodb';
import { retryWithBackoff } from '../../../../../lib/dynamodb-helpers';

export const runtime = 'nodejs';

// PATCH /api/players/[id]/reset - reset all match history for a player (keep player metadata)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const playerId = id.trim();

  if (!playerId) {
    return NextResponse.json({ message: 'Missing player id' }, { status: 400 });
  }

  try {
    // Find all MATCH records for this player (don't delete METADATA)
    const matchResponse = await retryWithBackoff(
      () =>
        getDocumentClient().send(
          new QueryCommand({
            TableName: getTableName(),
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :matchPrefix)',
            ExpressionAttributeValues: {
              ':pk': `PLAYER#${playerId}`,
              ':matchPrefix': 'MATCH#'
            }
          })
        ),
      { label: 'playerReset.queryMatches' }
    );

    const matches = matchResponse.Items ?? [];
    let deletedCount = 0;

    // Delete only MATCH items, not METADATA
    for (const match of matches) {
      await retryWithBackoff(
        () =>
          getDocumentClient().send(
            new DeleteCommand({
              TableName: getTableName(),
              Key: {
                PK: match.PK,
                SK: match.SK
              }
            })
          ),
        { label: 'playerReset.deleteMatchItem' }
      );
      deletedCount++;
    }

    return NextResponse.json(
      { message: 'Player match history reset successfully', deletedCount },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to reset player match history', error);
    return NextResponse.json(
      { message: 'Failed to reset player match history' },
      { status: 500 }
    );
  }
}
