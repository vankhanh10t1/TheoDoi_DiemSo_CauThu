import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { NextRequest, NextResponse } from 'next/server';
import { getDocumentClient, getTableName } from '../../../../lib/dynamodb';
import { findDuplicatePlayerByName } from '../../../../lib/playerService';

export const runtime = 'nodejs';

// PATCH /api/players/[id] - update player metadata (name, cardSeason, position)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const playerId = id.trim();

  if (!playerId) {
    return NextResponse.json({ message: 'Missing player id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
  }

  const candidate = body as Record<string, unknown>;
  const name = (candidate.name as string)?.trim() ?? '';
  const cardSeason = (candidate.cardSeason as string)?.trim() ?? (candidate.season as string)?.trim() ?? '';
  const position = (candidate.position as string)?.trim() ?? '';

  if (!name || !cardSeason || !position) {
    return NextResponse.json(
      { message: 'Required fields: name, cardSeason, position' },
      { status: 400 }
    );
  }

  try {
    const existingResponse = await getDocumentClient().send(
      new GetCommand({
        TableName: getTableName(),
        Key: {
          PK: `PLAYER#${playerId}`,
          SK: 'METADATA'
        }
      })
    );

    if (!existingResponse.Item) {
      return NextResponse.json({ message: 'Player not found' }, { status: 404 });
    }

    const existingItem = existingResponse.Item as Record<string, unknown>;
    const existingName = existingItem.Name as string;

    // Check for duplicate player name only if the name is changing
    if (existingName.toLowerCase().trim() !== name.toLowerCase().trim()) {
      const duplicatePlayerId = await findDuplicatePlayerByName(name, playerId);
      if (duplicatePlayerId) {
        return NextResponse.json(
          {
            message: `Cầu thủ "${name}" đã tồn tại trong hệ thống (ID: ${duplicatePlayerId}). Không thể cập nhật cầu thủ với tên bị trùng.`,
            code: 'DUPLICATE_PLAYER_NAME',
            duplicatePlayerId
          },
          { status: 409 }
        );
      }
    }

    await getDocumentClient().send(
      new PutCommand({
        TableName: getTableName(),
        Item: {
          PK: `PLAYER#${playerId}`,
          SK: 'METADATA',
          Name: name,
          CardSeason: cardSeason,
          Position: position,
          CreatedAt: existingItem.CreatedAt ?? new Date().toISOString()
        }
      })
    );

    return NextResponse.json(
      {
        message: 'Player updated successfully',
        playerId,
        name,
        cardSeason,
        position
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to update player', error);
    return NextResponse.json({ message: 'Failed to update player' }, { status: 500 });
  }
}

// DELETE /api/players/[id] - delete a player and all their match records
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const playerId = id.trim();

  if (!playerId) {
    return NextResponse.json({ message: 'Missing player id' }, { status: 400 });
  }

  try {
    // Find and delete all match records for this player
    const matchResponse = await getDocumentClient().send(
      new QueryCommand({
        TableName: getTableName(),
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `PLAYER#${playerId}`
        }
      })
    );

    const items = matchResponse.Items ?? [];

    // Delete METADATA and all MATCH items
    for (const item of items) {
      await getDocumentClient().send(
        new DeleteCommand({
          TableName: getTableName(),
          Key: {
            PK: item.PK,
            SK: item.SK
          }
        })
      );
    }

    return NextResponse.json(
      { message: 'Player deleted successfully', deletedCount: items.length },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to delete player', error);
    return NextResponse.json({ message: 'Failed to delete player' }, { status: 500 });
  }
}
