import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn()
}));

vi.mock('../lib/dynamodb', () => ({
  getDocumentClient: () => ({ send: sendMock }),
  getTableName: () => 'TEST_TABLE',
  formatMatchTimestamp: () => '20260610T120000Z'
}));

import {
  deleteMatch,
  deletePlayerMatchRating,
  resetPlayerMatchHistory,
  saveMatchRatings,
  updateMatch
} from '../lib/matchService';

function commandName(command: unknown): string {
  return (command as { constructor: { name: string } }).constructor.name;
}

function commandInput(command: unknown): Record<string, any> {
  return (command as { input: Record<string, any> }).input;
}

function getBatchDeleteKeys(): Array<{ PK: string; SK: string }> {
  return sendMock.mock.calls
    .filter(([command]) => commandName(command) === 'BatchWriteCommand')
    .flatMap(([command]) => commandInput(command).RequestItems.TEST_TABLE)
    .map((request) => request.DeleteRequest?.Key)
    .filter(Boolean);
}

beforeEach(() => {
  sendMock.mockReset();
});

describe('match service two-way data synchronization', () => {
  it('lưu rating hai chiều và RatingCount trong cùng transaction', async () => {
    sendMock.mockImplementation(async (command) => {
      if (commandName(command) === 'GetCommand') {
        return {
          Item: {
            PK: 'MATCH#match-1',
            SK: 'METADATA',
            MatchDate: '2026-06-10',
            MatchDateTime: '2026-06-10T09:00:00+07:00',
            MyScore: 1,
            OpponentScore: 0,
            Result: 'WIN',
            CreatedAt: 'created',
            UpdatedAt: 'updated'
          }
        };
      }
      if (commandName(command) === 'QueryCommand') return { Items: [] };
      return {};
    });

    await saveMatchRatings('match-1', {
      ratings: [{ playerId: 'player-1', rating: 8, position: 'ST' }]
    });

    const transaction = sendMock.mock.calls.find(
      ([command]) => commandName(command) === 'TransactWriteCommand'
    );
    const transactItems = commandInput(transaction?.[0]).TransactItems;
    expect(transactItems).toHaveLength(3);
    expect(transactItems.map((item: any) => item.Put?.Item?.PK).filter(Boolean)).toEqual(
      expect.arrayContaining(['MATCH#match-1', 'PLAYER#player-1'])
    );
    expect(transactItems.find((item: any) => item.Update)?.Update.ExpressionAttributeValues[':ratingCount']).toBe(1);
  });

  it('xóa trận ở cả match-centric và player-centric records', async () => {
    sendMock.mockImplementation(async (command) => {
      if (commandName(command) === 'QueryCommand') {
        return {
          Items: [
            {
              PK: 'MATCH#match-1',
              SK: 'RATING#player-1',
              PlayerId: 'player-1',
              Rating: 8,
              CreatedAt: 'created',
              UpdatedAt: 'updated'
            }
          ]
        };
      }
      return { UnprocessedItems: {} };
    });

    expect(await deleteMatch('match-1')).toBe(true);
    expect(getBatchDeleteKeys()).toEqual(
      expect.arrayContaining([
        { PK: 'MATCH#match-1', SK: 'METADATA' },
        { PK: 'MATCH#match-1', SK: 'RATING#player-1' },
        { PK: 'PLAYER#player-1', SK: 'MATCH#match-1' }
      ])
    );
  });

  it('xóa riêng rating ở cả hai chiều và cập nhật RatingCount', async () => {
    sendMock.mockImplementation(async (command) => {
      if (commandName(command) === 'QueryCommand') return { Items: [] };
      if (commandName(command) === 'GetCommand') {
        return {
          Item: {
            PK: 'MATCH#match-1',
            SK: 'METADATA',
            MatchDate: '2026-06-10',
            MyScore: 1,
            OpponentScore: 0,
            Result: 'WIN',
            CreatedAt: 'created',
            UpdatedAt: 'updated'
          }
        };
      }
      return { UnprocessedItems: {} };
    });

    expect(await deletePlayerMatchRating('match-1', 'player-1')).toBe(true);
    const transaction = sendMock.mock.calls.find(
      ([command]) => commandName(command) === 'TransactWriteCommand'
    );
    const transactItems = commandInput(transaction?.[0]).TransactItems;
    expect(transactItems.map((item: any) => item.Delete?.Key).filter(Boolean)).toEqual(
      expect.arrayContaining([
        { PK: 'MATCH#match-1', SK: 'RATING#player-1' },
        { PK: 'PLAYER#player-1', SK: 'MATCH#match-1' }
      ])
    );
    expect(transactItems.find((item: any) => item.Update)?.Update.ExpressionAttributeValues[':ratingCount']).toBe(0);
  });

  it('reset cầu thủ xóa rating hai chiều và cập nhật trận liên quan', async () => {
    let queryCount = 0;
    sendMock.mockImplementation(async (command) => {
      if (commandName(command) === 'QueryCommand') {
        queryCount++;
        return queryCount === 1
          ? { Items: [{ PK: 'PLAYER#player-1', SK: 'MATCH#match-1', MatchId: 'match-1' }] }
          : { Items: [] };
      }
      if (commandName(command) === 'GetCommand') return { Item: { PK: 'MATCH#match-1' } };
      return { UnprocessedItems: {} };
    });

    expect(await resetPlayerMatchHistory('player-1')).toBe(1);
    expect(getBatchDeleteKeys()).toEqual(
      expect.arrayContaining([
        { PK: 'MATCH#match-1', SK: 'RATING#player-1' },
        { PK: 'PLAYER#player-1', SK: 'MATCH#match-1' }
      ])
    );
    expect(sendMock.mock.calls.some(([command]) => commandName(command) === 'UpdateCommand')).toBe(true);
  });

  it('cập nhật trận ghi lại ngày, kết quả và cờ thắng đậm vào lịch sử cầu thủ', async () => {
    sendMock.mockImplementation(async (command) => {
      if (commandName(command) === 'GetCommand') {
        return {
          Item: {
            PK: 'MATCH#match-1',
            SK: 'METADATA',
            MatchDate: '2026-06-01',
            MatchDateTime: '2026-06-01T07:00',
            MyScore: 1,
            OpponentScore: 1,
            Result: 'DRAW',
            CreatedAt: 'created',
            UpdatedAt: 'updated'
          }
        };
      }
      if (commandName(command) === 'QueryCommand') {
        return {
          Items: [
            {
              PK: 'MATCH#match-1',
              SK: 'RATING#player-1',
              PlayerId: 'player-1',
              Rating: 8,
              Position: 'ST',
              CreatedAt: 'rating-created',
              UpdatedAt: 'rating-updated'
            }
          ]
        };
      }
      return { UnprocessedItems: {} };
    });

    const updated = await updateMatch('match-1', {
      matchDate: '2026-06-10',
      myScore: 4,
      opponentScore: 0
    });

    expect(updated?.result).toBe('WIN');
    const playerPut = sendMock.mock.calls
      .filter(([command]) => commandName(command) === 'BatchWriteCommand')
      .flatMap(([command]) => commandInput(command).RequestItems.TEST_TABLE)
      .map((request) => request.PutRequest?.Item)
      .find((item) => item?.PK === 'PLAYER#player-1');

    expect(playerPut).toMatchObject({
      MatchDate: '2026-06-10',
      MatchDateTime: '2026-06-10T07:00:00+07:00',
      Result: 'Win',
      IsBigWin: true,
      IsBigLoss: false
    });
  });
});
