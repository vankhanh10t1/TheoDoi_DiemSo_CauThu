import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { NextRequest, NextResponse } from 'next/server';
import { createMatchSortKey, getDocumentClient, getTableName } from '../../../lib/dynamodb';
import { getPlayerMetadata } from '../../../lib/playerService';
import type { MatchResult, RatingPayload } from '../../../lib/types';

export const runtime = 'nodejs';

function isMatchResult(value: unknown): value is MatchResult {
  return value === 'Win' || value === 'Draw' || value === 'Loss';
}

function parseRatingPayload(body: unknown): RatingPayload | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const playerId = typeof candidate.playerId === 'string' ? candidate.playerId.trim() : '';
  const score = typeof candidate.score === 'number' ? candidate.score : Number.NaN;
  const isStarter = typeof candidate.isStarter === 'boolean' ? candidate.isStarter : null;
  const result = candidate.result;

  if (!playerId || !Number.isFinite(score) || isStarter === null || !isMatchResult(result)) {
    return null;
  }

  if (score < 1 || score > 10) {
    return null;
  }

  return {
    playerId,
    score,
    isStarter,
    result
  };
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON payload' }, { status: 400 });
  }

  const payload = parseRatingPayload(body);
  if (!payload) {
    return NextResponse.json(
      {
        message: 'Validation failed: playerId, score, isStarter, result are required'
      },
      { status: 400 }
    );
  }

  const player = await getPlayerMetadata(payload.playerId);
  if (!player) {
    return NextResponse.json({ message: 'Player not found' }, { status: 404 });
  }

  const matchSortKey = createMatchSortKey();

  try {
    await getDocumentClient().send(
      new PutCommand({
        TableName: getTableName(),
        Item: {
          PK: `PLAYER#${payload.playerId}`,
          SK: matchSortKey,
          Score: payload.score,
          IsStarter: payload.isStarter,
          Result: payload.result
        },
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)'
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message.includes('ConditionalCheckFailedException')) {
      return NextResponse.json({ message: 'Match already saved for this timestamp' }, { status: 409 });
    }

    console.error('Failed to save rating', error);
    return NextResponse.json({ message: 'Failed to save rating' }, { status: 500 });
  }

  return NextResponse.json(
    {
      message: 'Rating saved successfully',
      sk: matchSortKey
    },
    { status: 201 }
  );
}