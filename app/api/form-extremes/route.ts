import { NextResponse } from 'next/server';
import { listPlayers, getRecentMatches } from '../../../lib/playerService';
import { analyzeRecentMatches } from '../../../lib/evaluationEngine';
import { sortRecentMatchesNewestFirst } from '../../../lib/match-history';
import type { RecentMatch } from '../../../lib/types';
import { MIN_MATCHES_FOR_EVALUATION } from '../../../lib/evaluation-policy';

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

    // TODO(schema): replace per-player queries with a materialized form view/GSI.
    // Queries run in parallel so one slow player does not serialize the whole response.
    const playerForms = (
      await Promise.all(
        players.map(async (player): Promise<PlayerFormData | null> => {
        const recentMatches = sortRecentMatchesNewestFirst(await getRecentMatches(player.playerId));

        if (recentMatches.length >= MIN_MATCHES_FOR_EVALUATION) {
          const analysis = analyzeRecentMatches(recentMatches);

          return {
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
          };
        }
        return null;
        })
      )
    ).filter((form): form is PlayerFormData => form !== null);

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
