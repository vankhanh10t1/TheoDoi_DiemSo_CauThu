import { NextRequest, NextResponse } from 'next/server';
import { resetPlayerMatchHistory } from '../../../../../lib/matchService';

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
    const deletedCount = await resetPlayerMatchHistory(playerId);

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
