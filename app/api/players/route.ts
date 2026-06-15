import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { NextRequest, NextResponse } from 'next/server';
import {
  getDocumentClient,
  getMissingDynamoEnvNames,
  getTableName,
  validateDynamoConfig
} from '../../../lib/dynamodb';
import { findDuplicatePlayerByName, listPlayers } from '../../../lib/playerService';
import { isDynamoThrottleError } from '../../../lib/dynamodb-helpers';
import { normalizeDetailedPosition } from '../../../lib/positions';
import { getPlayerNameReservationKey, normalizePlayerName } from '../../../lib/player-name';

export const runtime = 'nodejs';

function serializeApiError(error: unknown) {
  return {
    name: error instanceof Error ? error.name : 'UnknownError',
    message: error instanceof Error ? error.message : String(error)
  };
}

function isDynamoUnavailableError(error: unknown): boolean {
  const serialized = serializeApiError(error);
  return /CredentialsProviderError|ExpiredToken|InvalidSignature|NetworkingError|TimeoutError|ECONN|ENOTFOUND|EAI_AGAIN|ServiceUnavailable|InternalServerError/i.test(
    `${serialized.name} ${serialized.message}`
  );
}

function isValidPlayerId(id: string): boolean {
  return /^[A-Z0-9]{1,20}$/.test(id.trim());
}

// GET /api/players - list all players (from DynamoDB or fallback)
export async function GET() {
  const requestId = `players-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();

  try {
    const envChecks = {
      runtime: {
        nodeEnv: process.env.NODE_ENV ?? null,
        vercelEnv: process.env.VERCEL_ENV ?? null,
        vercelRegion: process.env.VERCEL_REGION ?? null,
        nextRuntime: process.env.NEXT_RUNTIME ?? null
      },
      AWS_ACCESS_KEY_ID: Boolean(process.env.AWS_ACCESS_KEY_ID),
      AWS_SECRET_ACCESS_KEY: Boolean(process.env.AWS_SECRET_ACCESS_KEY),
      AWS_REGION: Boolean(process.env.AWS_REGION),
      DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME ?? null,
      DYNAMODB_TABLE: process.env.DYNAMODB_TABLE ?? null,
      missing: getMissingDynamoEnvNames()
    };

    console.info(`[${requestId}] /api/players GET start`, envChecks);

    validateDynamoConfig();

    const items = await listPlayers();

    console.info(`[${requestId}] /api/players GET success`, {
      durationMs: Date.now() - startedAt,
      returnedCount: items.length
    });

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
    const durationMs = Date.now() - startedAt;
    if (isDynamoThrottleError(error)) {
      return NextResponse.json(
        {
          message: 'DynamoDB đang bị giới hạn đọc danh sách cầu thủ. Vui lòng thử lại sau vài giây.',
          error: serializedError.message,
          durationMs,
          requestId,
          code: 'DYNAMODB_THROTTLED'
        },
        { status: 429 }
      );
    }
    console.error(`[${requestId}] Failed to load players`, {
      error: serializedError,
      durationMs,
      envSnapshot: {
        nodeEnv: process.env.NODE_ENV ?? null,
        vercelEnv: process.env.VERCEL_ENV ?? null,
        vercelRegion: process.env.VERCEL_REGION ?? null,
        nextRuntime: process.env.NEXT_RUNTIME ?? null,
        hasAwsAccessKeyId: Boolean(process.env.AWS_ACCESS_KEY_ID),
        hasAwsSecretAccessKey: Boolean(process.env.AWS_SECRET_ACCESS_KEY),
        hasAwsRegion: Boolean(process.env.AWS_REGION),
        tableName: process.env.DYNAMODB_TABLE_NAME ?? null,
        tableAlias: process.env.DYNAMODB_TABLE ?? null
      }
    });
    const missingEnv = getMissingDynamoEnvNames();
    const status = isDynamoUnavailableError(error) ? 503 : 500;
    return NextResponse.json(
      {
        message:
          missingEnv.length > 0
            ? `Thiếu cấu hình DynamoDB local: ${missingEnv.join(', ')}`
            : status === 503
              ? 'Không thể kết nối DynamoDB. Vui lòng kiểm tra AWS credentials, region và kết nối mạng.'
              : 'Không thể tải danh sách cầu thủ từ DynamoDB.',
        error: serializedError.message,
        durationMs,
        requestId,
        code: missingEnv.length > 0 ? 'DYNAMODB_CONFIG_ERROR' : 'DYNAMODB_ERROR'
      },
      { status }
    );
  }
}

// POST /api/players - add a new player
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

  if (!playerId || !name || !season || !rawPosition) {
    // Allow server to generate playerId when missing
    if (!name || !season || !position) {
      return NextResponse.json(
        { message: 'Required fields: name, season, position' },
        { status: 400 }
      );
    }
    if (!playerId) {
      playerId = generatePlayerIdFromName(name);
    }
  }

  if (!position) {
    return NextResponse.json(
      { message: 'position không hợp lệ', code: 'INVALID_POSITION' },
      { status: 400 }
    );
  }

  if (!isValidPlayerId(playerId)) {
    return NextResponse.json(
      { message: 'playerId must be 1-20 alphanumeric characters' },
      { status: 400 }
    );
  }

  if (name.length > 100 || season.length > 50 || position.length > 20) {
    return NextResponse.json(
      { message: 'Field length exceeded' },
      { status: 400 }
    );
  }

  // Check for duplicate player name (case-insensitive, trimmed)
  try {
    const duplicatePlayerId = await findDuplicatePlayerByName(name);
    if (duplicatePlayerId) {
      return NextResponse.json(
        {
          message: `Cầu thủ "${name}" đã tồn tại trong hệ thống (ID: ${duplicatePlayerId}). Không thể thêm cầu thủ trùng tên.`,
          code: 'DUPLICATE_PLAYER_NAME',
          duplicatePlayerId
        },
        { status: 409 }
      );
    }
  } catch (error) {
    console.error('Error checking for duplicate player names:', error);
    return NextResponse.json(
      { message: 'Failed to validate player name uniqueness' },
      { status: 500 }
    );
  }

  // Try inserting, if playerId collides generate a new one and retry a few times
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const tableName = getTableName();
      await getDocumentClient().send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: tableName,
                Item: {
                  ...getPlayerNameReservationKey(name),
                  PlayerId: playerId,
                  NormalizedName: normalizePlayerName(name)
                },
                ConditionExpression: 'attribute_not_exists(PK)'
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
                  CardSeason: season,
                  Position: position,
                  CreatedAt: new Date().toISOString()
                },
                ConditionExpression: 'attribute_not_exists(PK)'
              }
            }
          ]
        })
      );

      // success
      return NextResponse.json(
        { message: 'Player created successfully', playerId },
        { status: 201 }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('TransactionCanceledException') || message.includes('ConditionalCheckFailedException')) {
        const duplicatePlayerId = await findDuplicatePlayerByName(name).catch(() => null);
        if (duplicatePlayerId) {
          return NextResponse.json(
            { message: `Cầu thủ "${name}" đã tồn tại trong hệ thống.`, code: 'DUPLICATE_PLAYER_NAME', duplicatePlayerId },
            { status: 409 }
          );
        }
        // collision, generate new id and retry
        playerId = generatePlayerIdFromName(name + Math.random().toString(36).slice(2, 6));
        continue;
      }

      console.error('Failed to create player', error);
      return NextResponse.json({ message: 'Failed to create player' }, { status: 500 });
    }
  }

  return NextResponse.json({ message: 'Failed to create player after retries' }, { status: 500 });
}
