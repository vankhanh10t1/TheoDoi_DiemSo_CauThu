import { NextRequest, NextResponse } from 'next/server';
import { isDetailedPositionForGroup, isPositionGroup } from '../../../lib/positions';
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
  const positionGroup = typeof candidate.positionGroup === 'string' ? candidate.positionGroup.trim() : '';
  const detailedPosition =
    typeof candidate.detailedPosition === 'string' ? candidate.detailedPosition.trim() : '';
  const yellowCards = typeof candidate.yellowCards === 'number' ? candidate.yellowCards : 0;
  const redCards = typeof candidate.redCards === 'number' ? candidate.redCards : 0;
  const fouls = typeof candidate.fouls === 'number' ? candidate.fouls : 0;
  const isBigWin = typeof candidate.isBigWin === 'boolean' ? candidate.isBigWin : false;
  const isBigLoss = typeof candidate.isBigLoss === 'boolean' ? candidate.isBigLoss : false;

  if (
    !playerId ||
    !Number.isFinite(score) ||
    isStarter === null ||
    !isMatchResult(result) ||
    !isPositionGroup(positionGroup) ||
    !isDetailedPositionForGroup(positionGroup, detailedPosition)
  ) {
    return null;
  }

  if (score < 1 || score > 10) {
    return null;
  }

  // validate card fields: integers >= 0
  if (!Number.isInteger(yellowCards) || yellowCards < 0) return null;
  if (!Number.isInteger(redCards) || redCards < 0) return null;
  if (!Number.isInteger(fouls) || fouls < 0) return null;

  // validate big win/loss flags based on result
  if (result === 'Win' && isBigLoss) return null;
  if (result === 'Loss' && isBigWin) return null;
  if (result === 'Draw' && (isBigWin || isBigLoss)) return null;

  return {
    playerId,
    score,
    isStarter,
    result,
    positionGroup,
    detailedPosition,
    yellowCards,
    redCards,
    fouls,
    isBigWin,
    isBigLoss
  };
}

export async function POST() {
  // Deprecated legacy endpoint. Use the match-first flow instead:
  // 1) POST /api/matches to create a Match
  // 2) POST /api/matches/:matchId/ratings to save many PlayerMatchRating
  return NextResponse.json(
    {
      message: 'This endpoint is deprecated. Use /api/matches and /api/matches/:matchId/ratings instead.'
    },
    { status: 410 }
  );
}
