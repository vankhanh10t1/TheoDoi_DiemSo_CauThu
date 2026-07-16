import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../lib/db';
import { findDuplicatePlayerByName, listPlayers } from '../../../lib/playerService';
import { normalizeDetailedPosition } from '../../../lib/positions';
import { normalizePlayerName } from '../../../lib/player-name';

export const runtime = 'nodejs';

function serializeApiError(error: unknown) {
  return {
    name: error instanceof Error ? error.name : 'UnknownError',
    message: error instanceof Error ? error.message : String(error)
  };
}

function isValidPlayerId(id: string): boolean {
  return /^[A-Z0-9]{1,20}$/.test(id.trim());
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

export async function GET() {
  const requestId = `players-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();

  try {
    console.info(`[${requestId}] /api/players GET start`, {
      nodeEnv: process.env.NODE_ENV ?? null,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      vercelRegion: process.env.VERCEL_REGION ?? null,
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL)
    });

    const items = await listPlayers();

    return NextResponse.json(
      {
        items,
        meta: {
          requestId,
          returnedCount: items.length,
          durationMs: Date.now() - startedAt
        }
      },
      { status: 200 }
    );
  } catch (error) {
    const serializedError = serializeApiError(error);
    console.error(`[${requestId}] Failed to load players`, {
      error: serializedError,
      durationMs: Date.now() - startedAt
    });

    return NextResponse.json(
      {
        message: process.env.DATABASE_URL
          ? 'Khong the tai danh sach cau thu tu Neon.'
          : 'Thieu cau hinh DATABASE_URL.',
        error: serializedError.message,
        durationMs: Date.now() - startedAt,
        requestId,
        code: process.env.DATABASE_URL ? 'DATABASE_ERROR' : 'DATABASE_CONFIG_ERROR'
      },
      { status: process.env.DATABASE_URL ? 500 : 503 }
    );
  }
}

function generatePlayerIdFromName(name: string): string {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
  const suffix = Math.floor(1000 + Math.random() * 9000).toString().slice(0, 4);
  return `${base}${suffix}` || `P${Date.now().toString().slice(-6)}`;
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ message: 'Body must be an object' }, { status: 400 });
  }

  const candidate = body as Record<string, unknown>;
  let playerId = (candidate.playerId as string)?.trim() ?? '';
  const name = (candidate.name as string)?.trim() ?? '';
  const season = (candidate.season as string)?.trim() ?? '';
  const rawPosition = (candidate.position as string)?.trim() ?? '';
  const position = normalizeDetailedPosition(rawPosition);

  if (!name || !season || !position) {
    return NextResponse.json(
      { message: 'Required fields: name, season, position' },
      { status: 400 }
    );
  }

  if (!playerId) {
    playerId = generatePlayerIdFromName(name);
  }

  if (!isValidPlayerId(playerId)) {
    return NextResponse.json(
      { message: 'playerId must be 1-20 alphanumeric characters' },
      { status: 400 }
    );
  }

  if (name.length > 100 || season.length > 50 || position.length > 20) {
    return NextResponse.json({ message: 'Field length exceeded' }, { status: 400 });
  }

  const duplicatePlayerId = await findDuplicatePlayerByName(name).catch((error) => {
    console.error('Error checking for duplicate player names:', error);
    throw error;
  });

  if (duplicatePlayerId) {
    return NextResponse.json(
      {
        message: `Cau thu "${name}" da ton tai trong he thong (ID: ${duplicatePlayerId}). Khong the them cau thu trung ten.`,
        code: 'DUPLICATE_PLAYER_NAME',
        duplicatePlayerId
      },
      { status: 409 }
    );
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await sql`
        insert into players (
          player_id,
          name,
          normalized_name,
          card_season,
          position,
          created_at,
          updated_at
        )
        values (
          ${playerId},
          ${name},
          ${normalizePlayerName(name)},
          ${season},
          ${position},
          now(),
          now()
        )
      `;

      return NextResponse.json(
        { message: 'Player created successfully', playerId },
        { status: 201 }
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        const duplicate = await findDuplicatePlayerByName(name).catch(() => null);
        if (duplicate) {
          return NextResponse.json(
            {
              message: `Cau thu "${name}" da ton tai trong he thong.`,
              code: 'DUPLICATE_PLAYER_NAME',
              duplicatePlayerId: duplicate
            },
            { status: 409 }
          );
        }

        playerId = generatePlayerIdFromName(`${name}${Math.random().toString(36).slice(2, 6)}`);
        continue;
      }

      console.error('Failed to create player', error);
      return NextResponse.json({ message: 'Failed to create player' }, { status: 500 });
    }
  }

  return NextResponse.json({ message: 'Failed to create player after retries' }, { status: 500 });
}
