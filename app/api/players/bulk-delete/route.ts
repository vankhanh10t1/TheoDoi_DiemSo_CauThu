import { NextRequest, NextResponse } from 'next/server';
import { deletePlayersAndRelatedData } from '../../../../lib/playerService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BulkDeleteRequestBody = {
  playerIds?: unknown;
};

function getPlayerIdsFromBody(body: BulkDeleteRequestBody): string[] {
  if (!Array.isArray(body.playerIds)) {
    return [];
  }

  return body.playerIds
    .filter((playerId): playerId is string => typeof playerId === 'string')
    .map((playerId) => playerId.trim())
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  const requestId = `bulk-delete-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let body: BulkDeleteRequestBody;

  try {
    body = (await request.json()) as BulkDeleteRequestBody;
  } catch {
    return NextResponse.json({ message: 'Invalid JSON payload', requestId }, { status: 400 });
  }

  const playerIds = getPlayerIdsFromBody(body);

  if (playerIds.length === 0) {
    return NextResponse.json(
      { message: 'Vui lòng chọn ít nhất 1 cầu thủ để xóa.', requestId },
      { status: 400 }
    );
  }

  if (playerIds.length > 100) {
    return NextResponse.json(
      { message: 'Chỉ có thể xóa tối đa 100 cầu thủ trong một lần.', requestId },
      { status: 400 }
    );
  }

  try {
    console.info(`[${requestId}] /api/players/bulk-delete start`, {
      requestedCount: playerIds.length
    });

    const result = await deletePlayersAndRelatedData(playerIds);

    console.info(`[${requestId}] /api/players/bulk-delete success`, {
      requestedCount: result.requestedCount,
      deletedPlayerCount: result.deletedPlayerIds.length,
      deletedItemCount: result.deletedItemCount
    });

    return NextResponse.json(
      {
        message: 'Players deleted successfully',
        requestId,
        deletedPlayerIds: result.deletedPlayerIds,
        deletedCount: result.deletedItemCount
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[${requestId}] Failed to bulk delete players`, {
      errorName: error instanceof Error ? error.name : undefined,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestedCount: playerIds.length
    });
    return NextResponse.json(
      {
        message: 'Không thể xóa cầu thủ lúc này. Vui lòng thử lại sau vài giây.',
        requestId,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Use POST /api/players/bulk-delete with body { playerIds: string[] }' },
    { status: 405 }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'POST, OPTIONS'
    }
  });
}
