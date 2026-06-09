import type { RecentMatch } from '../types';

type DisciplineResult = {
  disciplineScore: number; // 0..100
  disciplineLevel: 'GOOD' | 'AVERAGE' | 'POOR';
};

export const DEFAULT_POSITION_PENALTY: Record<string, { yellowWeight: number; redWeight: number }> = {
  CDM: { yellowWeight: 0.8, redWeight: 1 },
  CB: { yellowWeight: 0.8, redWeight: 1 },
  ST: { yellowWeight: 1, redWeight: 1.2 },
  GK: { yellowWeight: 1, redWeight: 1.5 }
};

function normalizeScore(value: number, min = 0, max = 10) {
  const clamped = Math.max(min, Math.min(max, value));
  return (clamped - min) / (max - min) * 100;
}

export function calculateAggressionIndex(stats: { fouls?: number; yellowCards?: number; redCards?: number; matchCount?: number }): { aggressionIndex: number; aggressionLevel: 'LOW' | 'MEDIUM' | 'HIGH' } {
  const fouls = stats.fouls ?? 0;
  const yellow = stats.yellowCards ?? 0;
  const red = stats.redCards ?? 0;
  const matchCount = Math.max(1, stats.matchCount ?? 1);

  const aggressionIndex = Number(
    (((fouls * 0.5) + (yellow * 2) + (red * 5)) / matchCount).toFixed(2)
  );

  let level: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (aggressionIndex >= 3) level = 'HIGH';
  else if (aggressionIndex >= 1.25) level = 'MEDIUM';

  return { aggressionIndex, aggressionLevel: level };
}

export function calculateDisciplineScore(matches: RecentMatch[], positionPenaltyMap?: Record<string, { yellowWeight: number; redWeight: number }>): DisciplineResult {
  const map = { ...DEFAULT_POSITION_PENALTY, ...(positionPenaltyMap ?? {}) };

  if (!matches || matches.length === 0) {
    return { disciplineScore: 100, disciplineLevel: 'GOOD' };
  }

  let raw = 0;
  let count = 0;

  for (const m of matches) {
    const yellow = m.yellowCards ?? 0;
    const red = m.redCards ?? 0;
    const fouls = m.fouls ?? 0;
    const pos = m.detailedPosition ?? 'CM';
    const penalty = map[pos] ?? { yellowWeight: 1, redWeight: 1 };

    // Lower score means worse discipline; we invert later to 0..100 where higher is better
    const matchPenalty = (yellow * penalty.yellowWeight * 1.5) + (red * penalty.redWeight * 3) + (fouls * 0.1);
    raw += matchPenalty;
    count += 1;
  }

  const avgPenalty = raw / count; // typical range 0..10+
  // Convert to a 0..100 disciplineScore where larger is better
  const disciplineScore = Math.max(0, Math.min(100, Number((100 - avgPenalty * 8).toFixed(2))));

  let level: DisciplineResult['disciplineLevel'] = 'GOOD';
  if (disciplineScore < 60) level = 'POOR';
  else if (disciplineScore < 80) level = 'AVERAGE';

  return { disciplineScore, disciplineLevel: level };
}

export function calculateDisciplineTrend(history: RecentMatch[]): 'IMPROVING' | 'STABLE' | 'DETERIORATING' {
  if (!history || history.length < 2) return 'STABLE';

  const scores = history.map((m) => ((m.yellowCards ?? 0) * 2) + ((m.redCards ?? 0) * 5) + (m.fouls ?? 0) * 0.2);
  // History is newest-first: compare recent discipline penalty with older penalty.
  const mid = Math.floor(scores.length / 2);
  const recentAvg = scores.slice(0, mid).reduce((s, v) => s + v, 0) / Math.max(1, mid);
  const olderAvg = scores.slice(mid).reduce((s, v) => s + v, 0) / Math.max(1, scores.length - mid);

  if (recentAvg < olderAvg - 0.5) return 'IMPROVING';
  if (recentAvg > olderAvg + 0.5) return 'DETERIORATING';
  return 'STABLE';
}

export function calculateDisciplineVariance(history: RecentMatch[]): number {
  const values = history.map((m) => ((m.yellowCards ?? 0) * 2) + ((m.redCards ?? 0) * 5) + (m.fouls ?? 0) * 0.2);
  if (values.length === 0) return 0;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  return Number(variance.toFixed(2));
}

export default {
  calculateDisciplineScore,
  calculateAggressionIndex,
  calculateDisciplineTrend,
  calculateDisciplineVariance
};
