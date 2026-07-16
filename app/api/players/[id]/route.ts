import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import {
  deletePlayersAndRelatedData,
  findDuplicatePlayerByName,
  getPlayerMetadata
} from '../../../../lib/playerService';
import { normalizeDetailedPosition } from '../../../../lib/positions';
import { normalizePlayerName } from '../../../../lib/player-name';

export const runtime = 'nodejs';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

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
    const player = await getPlayerMetadata(playerId);
    if (!player) {
      return NextResponse.json({ message: 'Player not found' }, { status: 404 });
    }

    return NextResponse.json(player, { status: 200 });
  } catch (error) {
    console.error('Failed to load player metadata', error);
    return NextResponse.json({ message: 'Failed to load player' }, { status: 500 });
  }
}

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
      { message: 'position khong hop le', code: 'INVALID_POSITION' },
      { status: 400 }
    );
  }

  try {
    const existing = await getPlayerMetadata(playerId);
    if (!existing) {
      return NextResponse.json({ message: 'Player not found' }, { status: 404 });
    }

    if (normalizePlayerName(existing.name) !== normalizePlayerName(name)) {
      const duplicatePlayerId = await findDuplicatePlayerByName(name, playerId);
      if (duplicatePlayerId) {
        return NextResponse.json(
          {
            message: `Cau thu "${name}" da ton tai trong he thong (ID: ${duplicatePlayerId}). Khong the cap nhat cau thu voi ten bi trung.`,
            code: 'DUPLICATE_PLAYER_NAME',
            duplicatePlayerId
          },
          { status: 409 }
        );
      }
    }

    const rows = (await sql`
      update players
      set
        name = ${name},
        normalized_name = ${normalizePlayerName(name)},
        card_season = ${cardSeason},
        position = ${position},
        updated_at = now()
      where player_id = ${playerId}
      returning player_id
    `) as Array<{ player_id: string }>;

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Player not found' }, { status: 404 });
    }

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
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { message: `Cau thu "${name}" da ton tai trong he thong.`, code: 'DUPLICATE_PLAYER_NAME' },
        { status: 409 }
      );
    }
    return NextResponse.json({ message: 'Failed to update player' }, { status: 500 });
  }
}

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
