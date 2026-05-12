import { describe, expect, it } from 'vitest';
import { buildRecommendationsFromTableItems } from '../lib/recommendationService';

describe('recommendationService', () => {
  it('includes every player that has at least one rating entry, even without metadata', () => {
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

    // Now we only include players that have METADATA present
    expect(recommendations.map((item) => item.playerId)).toEqual(['P001']);

    expect(recommendations[0]).toMatchObject({
      playerId: 'P001',
      name: 'Player One',
      cardSeason: '22EA',
      position: 'ST',
      matchCount: 3,
      recommendation: 'HOLD',
      trend: 'UP'
    });
  });
});
