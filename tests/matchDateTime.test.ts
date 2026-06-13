import { describe, expect, it } from 'vitest';
import {
  createMatchDateTime,
  createSubmitMatchDateTime,
  getVietnamDateInputValue,
  isValidMatchDate,
  isValidMatchDateTime
} from '../lib/match-datetime';

describe('match datetime validation', () => {
  it('chấp nhận ngày giờ hợp lệ và từ chối giá trị bị rollover', () => {
    expect(isValidMatchDate('2026-06-10')).toBe(true);
    expect(isValidMatchDate('2026-02-31')).toBe(false);
    expect(isValidMatchDateTime('2026-06-10T20:30')).toBe(true);
    expect(isValidMatchDateTime('2026-06-10T20:30:15.123Z')).toBe(true);
    expect(isValidMatchDateTime('2026-06-10T24:00')).toBe(false);
  });

  it('captures the real submit timestamp instead of the legacy 07:00 fallback', () => {
    expect(createSubmitMatchDateTime(new Date('2026-06-13T06:55:42.123Z'))).toBe(
      '2026-06-13T06:55:42.123Z'
    );
  });

  it('tạo thời gian trận từ ngày thi đấu thay vì thời điểm nhập dữ liệu', () => {
    expect(createMatchDateTime('2026-06-10')).toBe('2026-06-10T07:00:00+07:00');
    expect(createMatchDateTime('2026-06-10', '20:30')).toBe('2026-06-10T20:30:00+07:00');
    expect(() => createMatchDateTime('2026-02-31')).toThrow('Invalid match date or time');
  });

  it('lấy ngày mặc định theo múi giờ Việt Nam thay vì ngày UTC', () => {
    expect(getVietnamDateInputValue(new Date('2026-06-09T18:30:00.000Z'))).toBe('2026-06-10');
  });
});
