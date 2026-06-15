import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { NextRequest, NextResponse } from 'next/server';
import { getDocumentClient, getTableName } from '../../../../lib/dynamodb';
import { retryWithBackoff } from '../../../../lib/dynamodb-helpers';
import { deletePlayersAndRelatedData, findDuplicatePlayerByName } from '../../../../lib/playerService';
import { normalizeDetailedPosition } from '../../../../lib/positions';
import { getPlayerNameReservationKey, normalizePlayerName } from '../../../../lib/player-name';

export const runtime = 'nodejs';

// GET /api/players/[id] - return player metadata
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const playerId = id.trim();

  if (!playerId) {
    return NextResponse.json({ message: 'Missing player id' }, { status: 400 });
  }

  try {
    const response = await retryWithBackoff(
      () =>
        getDocumentClient().send(
          new GetCommand({
            TableName: getTableName(),
            Key: {
              PK: `PLAYER#${playerId}`,
              SK: 'METADATA'
            }
          })
        ),
      { label: 'player.getMetadata' }
    );

    if (!response.Item) {
      return NextResponse.json({ message: 'Player not found' }, { status: 404 });
    }

    const item = response.Item as Record<string, unknown>;

    return NextResponse.json(
      {
        playerId,
        name: (item.Name as string) ?? '',
        cardSeason: (item.CardSeason as string) ?? (item.Season as string) ?? '',
        position: (item.Position as string) ?? ''
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to load player metadata', error);
    return NextResponse.json({ message: 'Failed to load player' }, { status: 500 });
  }
}
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
  const rawPosition = (candidate.position as string)?.trim() ?? '';
  const position = normalizeDetailedPosition(rawPosition);

  if (!name || !cardSeason || !rawPosition) {
    return NextResponse.json(
      { message: 'Required fields: name, cardSeason, position' },
      { status: 400 }
    );
  }

  if (!position) {
    return NextResponse.json(
      { message: 'position không hợp lệ', code: 'INVALID_POSITION' },
      { status: 400 }
    );
  }

  try {
    const existingResponse = await retryWithBackoff(
      () =>
        getDocumentClient().send(
          new GetCommand({
            TableName: getTableName(),
            Key: {
              PK: `PLAYER#${playerId}`,
              SK: 'METADATA'
            }
          })
        ),
      { label: 'player.getExistingMetadata' }
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

    const tableName = getTableName();
    const transactItems: NonNullable<ConstructorParameters<typeof TransactWriteCommand>[0]['TransactItems']> = [];
    if (normalizePlayerName(existingName) !== normalizePlayerName(name)) {
      transactItems.push({
        Delete: {
          TableName: tableName,
          Key: getPlayerNameReservationKey(existingName),
          ConditionExpression: 'attribute_not_exists(PK) OR PlayerId = :playerId',
          ExpressionAttributeValues: { ':playerId': playerId }
        }
      });
    }
    transactItems.push(
      {
        Put: {
          TableName: tableName,
          Item: {
            ...getPlayerNameReservationKey(name),
            PlayerId: playerId,
            NormalizedName: normalizePlayerName(name)
          },
          ConditionExpression: 'attribute_not_exists(PK) OR PlayerId = :playerId',
          ExpressionAttributeValues: { ':playerId': playerId }
        }
      },
      {
        Put: {
          TableName: tableName,
          Item: {
            PK: `PLAYER#${playerId}`,
            SK: 'METADATA',
            Name: name,
            NormalizedName: normalizePlayerName(name),
            CardSeason: cardSeason,
            Position: position,
            CreatedAt: existingItem.CreatedAt ?? new Date().toISOString()
          },
          ConditionExpression: 'attribute_exists(PK)'
        }
      }
    );

    await retryWithBackoff(
      () => getDocumentClient().send(new TransactWriteCommand({ TransactItems: transactItems })),
      { label: 'player.updateMetadata' }
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
    if (
      error instanceof Error &&
      (error.name === 'TransactionCanceledException' ||
        error.message.includes('TransactionCanceledException'))
    ) {
      return NextResponse.json(
        { message: `Cầu thủ "${name}" đã tồn tại trong hệ thống.`, code: 'DUPLICATE_PLAYER_NAME' },
        { status: 409 }
      );
    }
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
    const result = await deletePlayersAndRelatedData([playerId]);

    return NextResponse.json(
      { message: 'Player deleted successfully', deletedCount: result.deletedItemCount },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to delete player', error);
    return NextResponse.json({ message: 'Failed to delete player' }, { status: 500 });
  }
}
