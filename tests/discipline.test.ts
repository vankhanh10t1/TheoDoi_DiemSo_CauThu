import { describe, it, expect } from 'vitest';
import { calculateDisciplineScore, calculateAggressionIndex, calculateDisciplineTrend } from '../lib/analytics/discipline';

const sampleMatches = [
  { score: 7, result: 'Win', yellowCards: 0, redCards: 0, fouls: 1 },
  { score: 6, result: 'Draw', yellowCards: 1, redCards: 0, fouls: 2 },
  { score: 5, result: 'Loss', yellowCards: 2, redCards: 0, fouls: 3 }
] as any;

describe('Discipline module', () => {
  it('calculates aggression index correctly', () => {
    const r = calculateAggressionIndex({ fouls: 6, yellowCards: 3, redCards: 1 });
    expect(r.aggressionIndex).toBeGreaterThan(0);
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(r.aggressionLevel);
  });

  it('calculates discipline score and level', () => {
    const d = calculateDisciplineScore(sampleMatches);
    expect(d.disciplineScore).toBeGreaterThanOrEqual(0);
    expect(['GOOD', 'AVERAGE', 'POOR']).toContain(d.disciplineLevel);
  });

  it('detects discipline trend', () => {
    const t = calculateDisciplineTrend(sampleMatches);
    expect(['IMPROVING', 'STABLE', 'DETERIORATING']).toContain(t);
  });
});
