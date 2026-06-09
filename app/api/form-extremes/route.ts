import { NextResponse } from 'next/server';
import { listPlayers, getRecentMatches } from '../../../lib/playerService';
import { analyzeRecentMatches } from '../../../lib/evaluationEngine';
import type { RecentMatch } from '../../../lib/types';

export const runtime = 'nodejs';

interface PlayerFormData {
  playerId: string;
  name: string;
  cardSeason: string;
  position: string;
  averageScore: number;
  wmaScore: number;
  currentFormScore: number;
  matchCount: number;
  status: string;
  color: string;
  trendStatus: string;
  stabilityLevel: string;
  momentumStatus: string;
  riskLevel: string;
  recentMatches: RecentMatch[];
}

interface FormExtremesResponse {
  bestForm: PlayerFormData | null;
  worstForm: PlayerFormData | null;
  allForms: PlayerFormData[];
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
        allForms: [],
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
          const analysis = analyzeRecentMatches(recentMatches);

          playerForms.push({
            playerId: player.playerId,
            name: player.name,
            cardSeason: player.cardSeason ?? '',
            position: player.position,
            averageScore: analysis.averageScore,
            wmaScore: analysis.wmaScore,
            currentFormScore: analysis.currentFormScore,
            matchCount: recentMatches.length,
            status: analysis.currentFormScore > 8 ? 'Star Player' : analysis.currentFormScore >= 6 ? 'Stable' : analysis.currentFormScore >= 4.5 ? 'Under Review' : 'Fraud',
            color: analysis.currentFormScore > 8 ? 'green' : analysis.currentFormScore >= 6 ? 'white' : analysis.currentFormScore >= 4.5 ? 'orange' : 'red',
            trendStatus: analysis.trendStatus,
            stabilityLevel: analysis.stabilityLevel,
            momentumStatus: analysis.momentumStatus,
            riskLevel: analysis.riskLevel,
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
        current.wmaScore > best.wmaScore ? current : best
      );

      worstForm = playerForms.reduce((worst, current) =>
        current.wmaScore < worst.wmaScore ? current : worst
      );
    }

    return NextResponse.json(
      {
        bestForm,
        worstForm,
        allForms: playerForms,
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
