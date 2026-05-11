import { PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { NextRequest, NextResponse } from 'next/server';
import { getDocumentClient, getTableName } from '../../../lib/dynamodb';

export const runtime = 'nodejs';

function isValidPlayerId(id: string): boolean {
  return /^[A-Z0-9]{1,20}$/.test(id.trim());
}

// GET /api/players - list all players (from DynamoDB or fallback)
export async function GET() {
  const requestId = `players-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();

  try {
    const envChecks = {
      AWS_ACCESS_KEY_ID: Boolean(process.env.AWS_ACCESS_KEY_ID),
      AWS_SECRET_ACCESS_KEY: Boolean(process.env.AWS_SECRET_ACCESS_KEY),
      AWS_REGION: Boolean(process.env.AWS_REGION),
      DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME ?? null,
      DYNAMODB_TABLE: process.env.DYNAMODB_TABLE ?? null
    };

    console.info(`[${requestId}] /api/players GET start`, envChecks);

    if (!envChecks.AWS_ACCESS_KEY_ID || !envChecks.AWS_SECRET_ACCESS_KEY || !envChecks.AWS_REGION) {
      throw new Error(
        `Missing AWS env vars: ${[
          !envChecks.AWS_ACCESS_KEY_ID ? 'AWS_ACCESS_KEY_ID' : null,
          !envChecks.AWS_SECRET_ACCESS_KEY ? 'AWS_SECRET_ACCESS_KEY' : null,
          !envChecks.AWS_REGION ? 'AWS_REGION' : null
        ]
          .filter(Boolean)
          .join(', ')}`
      );
    }

    const tableName = getTableName();
    console.info(`[${requestId}] Using DynamoDB table`, { tableName });

    const response = await getDocumentClient().send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: 'SK = :metadata',
        ExpressionAttributeValues: {
          ':metadata': 'METADATA'
        }
      })
    );

    console.info(`[${requestId}] Scan completed`, {
      itemCount: response.Items?.length ?? 0,
      scannedCount: response.ScannedCount,
      count: response.Count,
      consumedCapacity: response.ConsumedCapacity
    });

    const items = (response.Items ?? []).map((item: any) => ({
      playerId: item.PK?.replace(/^PLAYER#/, ''),
      name: item.Name,
      season: item.Season,
      position: item.Position
    }));

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
          tableName,
          durationMs: Date.now() - startedAt
        }
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - startedAt;
    console.error(`[${requestId}] Failed to load players`, {
      errorMessage,
      durationMs
    });
    return NextResponse.json(
      {
        message: 'Failed to load players from DynamoDB',
        error: errorMessage,
        durationMs,
        requestId,
        hints: [
          'Check AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and DYNAMODB_TABLE_NAME/DYNAMODB_TABLE on Vercel',
          'Confirm the IAM user has dynamodb:Scan permission on the target table',
          'Verify the table name exists in the same AWS region configured for the app'
        ]
      },
      { status: 500 }
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
  const position = (candidate.position as string)?.trim() ?? '';

  if (!playerId || !name || !season || !position) {
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

  // Try inserting, if playerId collides generate a new one and retry a few times
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await getDocumentClient().send(
        new PutCommand({
          TableName: getTableName(),
          Item: {
            PK: `PLAYER#${playerId}`,
            SK: 'METADATA',
            Name: name,
            Season: season,
            Position: position,
            CreatedAt: new Date().toISOString()
          },
          ConditionExpression: 'attribute_not_exists(PK)'
        })
      );

      // success
      return NextResponse.json(
        { message: 'Player created successfully', playerId },
        { status: 201 }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('ConditionalCheckFailedException')) {
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
