import type { EventStatsSummary, RecentMatch } from '../types';
import { PARTICIPATION_CONFIG } from './performance-config';

export function calculateEventStats(matches: RecentMatch[]): EventStatsSummary {
  const totalMinutes = matches.reduce((sum, match) => sum +
    (typeof match.minutesPlayed === 'number' && match.minutesPlayed > 0
      ? match.minutesPlayed
      : PARTICIPATION_CONFIG.fallbackMinutes), 0);
  const per90Available = totalMinutes >= PARTICIPATION_CONFIG.reliablePer90Minutes;
  const raw = (key: 'goals' | 'assists' | 'yellowCards' | 'redCards' | 'fouls') =>
    matches.reduce((sum, match) => sum + Math.max(0, match[key] ?? 0), 0);
  const value = (count: number) => ({ raw: count, per90: per90Available && totalMinutes > 0
    ? Number((count * 90 / totalMinutes).toFixed(2)) : null });
  const yellowCards = raw('yellowCards');
  const redCards = raw('redCards');
  const fouls = raw('fouls');
  return {
    totalMinutes, per90Available,
    sampleWarning: per90Available ? undefined : `Cần tối thiểu ${PARTICIPATION_CONFIG.reliablePer90Minutes} phút để hiển thị chỉ số per 90 đáng tin cậy.`,
    goals: value(raw('goals')), assists: value(raw('assists')),
    yellowCards: value(yellowCards), redCards: value(redCards), fouls: value(fouls),
    disciplineEvents: value(yellowCards + redCards + fouls)
  };
}
