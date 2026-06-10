import { describe, expect, it } from 'vitest';
import { isValidMatchDate, isValidMatchDateTime } from '../lib/match-datetime';

describe('match datetime validation', () => {
  it('chấp nhận ngày giờ hợp lệ và từ chối giá trị bị rollover', () => {
    expect(isValidMatchDate('2026-06-10')).toBe(true);
    expect(isValidMatchDate('2026-02-31')).toBe(false);
    expect(isValidMatchDateTime('2026-06-10T20:30')).toBe(true);
    expect(isValidMatchDateTime('2026-06-10T24:00')).toBe(false);
  });
});
