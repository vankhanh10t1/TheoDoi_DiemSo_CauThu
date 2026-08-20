import { describe, expect, it } from 'vitest';
import { classifyAverageScore, evaluateRecentMatches, roundToOneDecimal } from '../lib/evaluationEngine';

describe('evaluationEngine', () => {
  it('rounds to one decimal place', () => {
    expect(roundToOneDecimal(7.26)).toBe(7.3);
  });

  it('classifies star player when score is above 8', () => {
    expect(classifyAverageScore(8.05)).toEqual({
      averageScore: 8.1,
      status: 'Star Player',
      action: 'Giữ chặt đội hình chính',
      color: 'green'
    });
  });

  it('classifies stable at the inclusive boundary', () => {
    expect(classifyAverageScore(8)).toEqual({
      averageScore: 8.0,
      status: 'Stable',
      action: 'Tiếp tục tin dùng',
      color: 'white'
    });
  });

  it('classifies under review and neutral monitoring status by thresholds', () => {
    expect(classifyAverageScore(4.5)).toEqual({
      averageScore: 4.5,
      status: 'Under Review',
      action: 'Đẩy lên ghế dự bị',
      color: 'orange'
    });

    expect(classifyAverageScore(4.44)).toEqual({
      averageScore: 4.4,
      status: 'Needs Monitoring',
      action: 'Cần theo dõi thêm',
      color: 'red'
    });
  });

  it('evaluates the latest five matches', () => {
    const result = evaluateRecentMatches([
      { sk: 'MATCH#5', score: 9, result: 'Win' },
      { sk: 'MATCH#4', score: 8, result: 'Win' },
      { sk: 'MATCH#3', score: 7, result: 'Draw' },
      { sk: 'MATCH#2', score: 6, result: 'Loss' },
      { sk: 'MATCH#1', score: 5, result: 'Loss' },
      { sk: 'MATCH#0', score: 1, result: 'Loss' }
    ]);

    expect(result).toEqual({
      averageScore: 8,
      status: 'Stable',
      action: 'Tiếp tục tin dùng',
      color: 'white'
    });
  });
});
