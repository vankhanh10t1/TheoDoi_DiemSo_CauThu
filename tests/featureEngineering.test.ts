import { describe, it, expect } from 'vitest';
import { buildFeatureVector } from '../lib/featureEngineering';

const matches = [
  { score: 7, result: 'Win', yellowCards: 0, redCards: 0, fouls: 1 },
  { score: 6, result: 'Draw', yellowCards: 1, redCards: 0, fouls: 2 },
  { score: 5, result: 'Loss', yellowCards: 2, redCards: 0, fouls: 3 }
] as any;

describe('Feature engineering', () => {
  it('builds feature vector with expected keys', () => {
    const fv = buildFeatureVector(matches);
    expect(fv).toHaveProperty('avg_score');
    expect(fv).toHaveProperty('weighted_average');
    expect(fv).toHaveProperty('discipline_score');
    expect(fv).toHaveProperty('aggression_index');
  });
});
