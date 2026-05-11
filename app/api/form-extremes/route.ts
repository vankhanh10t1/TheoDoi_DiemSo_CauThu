import { NextResponse } from 'next/server';
import { listPlayers, getRecentMatches } from '../../../lib/playerService';
import { evaluateRecentMatches } from '../../../lib/evaluationEngine';
import type { RecentMatch } from '../../../lib/types';

export const runtime = 'nodejs';

interface PlayerFormData {
  playerId: string;
  name: string;
  position: string;
  averageScore: number;
  matchCount: number;
  status: string;
  color: string;
  recentMatches: RecentMatch[];
}

interface FormExtremesResponse {
  bestForm: PlayerFormData | null;
  worstForm: PlayerFormData | null;
  totalPlayers: number;
  evaluatedPlayers: number;
}

export async function GET() {
  try {
    const players = await listPlayers();

    if (players.length === 0) {
      return NextResponse.json(
        {
          bestForm: null,
          worstForm: null,
          totalPlayers: 0,
          evaluatedPlayers: 0
        },
        { status: 200 }
      );
    }

    const playerForms: PlayerFormData[] = [];

    // Fetch form data for all players
    for (const player of players) {
      try {
        const recentMatches = await getRecentMatches(player.playerId);

        if (recentMatches.length > 0) {
          const assessment = evaluateRecentMatches(recentMatches);

          playerForms.push({
            playerId: player.playerId,
            name: player.name,
            position: player.position,
            averageScore: assessment.averageScore,
            matchCount: recentMatches.length,
            status: assessment.status,
            color: assessment.color,
            recentMatches
          });
        }
      } catch (error) {
        console.error(`Error fetching form for player ${player.playerId}:`, error);
        // Skip this player and continue
      }
    }

    let bestForm: PlayerFormData | null = null;
    let worstForm: PlayerFormData | null = null;

    if (playerForms.length > 0) {
      bestForm = playerForms.reduce((best, current) =>
        current.averageScore > best.averageScore ? current : best
      );

      worstForm = playerForms.reduce((worst, current) =>
        current.averageScore < worst.averageScore ? current : worst
      );
    }

    return NextResponse.json(
      {
        bestForm,
        worstForm,
        totalPlayers: players.length,
        evaluatedPlayers: playerForms.length
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/form-extremes:', error);
    return NextResponse.json(
      { message: 'Lỗi khi lấy dữ liệu phong độ' },
      { status: 500 }
    );
  }
}
