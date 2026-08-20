import type { BacktestPlayer } from '../../lib/analytics/backtest';
import type { PositionGroup, RecentMatch } from '../../lib/types';

function history(player: string, positionGroup: PositionGroup, scores: number[], offset: number): RecentMatch[] {
  return scores.map((score, index) => ({
    sk: `${player}-M${index + 1}`,
    matchId: `${player}-M${index + 1}`,
    matchDate: `2026-${String(offset).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`,
    score,
    result: index % 4 === 3 ? 'Loss' : index % 3 === 2 ? 'Draw' : 'Win',
    isBigLoss: index % 4 === 3,
    positionGroup,
    minutesPlayed: index % 5 === 4 ? 45 : 90,
    isStarter: true,
    season: index < 6 ? '2025-26' : '2026-27',
    competition: index % 4 === 0 ? 'Cup' : 'League',
    matchType: index % 4 === 0 ? 'CUP' : 'LEAGUE'
  }));
}

export const ANONYMOUS_BACKTEST_FIXTURE: BacktestPlayer[] = [
  { playerId: 'anon-gk', playerName: 'Player A', positionGroup: 'GK', matches: history('A', 'GK', [6, 6.4, 6.2, 6.8, 6.5, 7, 6.7, 7.1, 6.9, 7.2, 7, 7.3], 1) },
  { playerId: 'anon-df', playerName: 'Player B', positionGroup: 'DF', matches: history('B', 'DF', [7, 6.8, 7.2, 6.5, 6.9, 7.1, 6.7, 7, 7.3, 7.1, 7.4, 7.2], 2) },
  { playerId: 'anon-mf', playerName: 'Player C', positionGroup: 'MF', matches: history('C', 'MF', [5.8, 6.2, 6.5, 6.7, 7, 7.2, 7.4, 7.1, 7.6, 7.8, 7.5, 8], 3) },
  { playerId: 'anon-fw', playerName: 'Player D', positionGroup: 'FW', matches: history('D', 'FW', [8, 7.4, 8.2, 6.8, 7.7, 8.4, 7.1, 8.1, 7.5, 8.5, 7.8, 8.2], 4) }
];
