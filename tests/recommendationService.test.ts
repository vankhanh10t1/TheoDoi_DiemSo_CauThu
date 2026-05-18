import { describe, expect, it } from 'vitest';
import { buildRecommendationsFromTableItems } from '../lib/recommendationService';

describe('recommendationService', () => {
  it('builds a recommendation with the new hybrid metrics', () => {
    const recommendations = buildRecommendationsFromTableItems([
      {
        PK: 'PLAYER#P001',
        SK: 'METADATA',
        Name: 'Player One',
        CardSeason: '22EA',
        Position: 'ST'
      },
      {
        PK: 'PLAYER#P001',
        SK: 'MATCH#20260503T120000Z',
        Score: 9,
        Result: 'Win'
      },
      {
        PK: 'PLAYER#P001',
        SK: 'MATCH#20260502T120000Z',
        Score: 8,
        Result: 'Win'
      },
      {
        PK: 'PLAYER#P001',
        SK: 'MATCH#20260501T120000Z',
        Score: 7,
        Result: 'Draw'
      },
      {
        PK: 'PLAYER#P002',
        SK: 'MATCH#20260503T120000Z',
        Score: 4,
        Result: 'Loss'
      },
      {
        PK: 'PLAYER#P003',
        SK: 'METADATA',
        Name: 'Player Three',
        CardSeason: '23WB',
        Position: 'MF'
      }
    ]);

    expect(recommendations.map((item) => item.playerId)).toEqual(['P001']);

    expect(recommendations[0]).toMatchObject({
      playerId: 'P001',
      name: 'Player One',
      cardSeason: '22EA',
      position: 'ST',
      matchCount: 3,
      recommendation: 'KEEP',
      status: 'Stable',
      trend: 'UP',
      wmaScore: 8.46,
      fraudRisk: false
    });
  });
});
