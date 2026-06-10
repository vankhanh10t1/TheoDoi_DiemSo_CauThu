import { describe, expect, it } from 'vitest';
import { hasAtMostOneDecimalPlace, parseDecimalRating } from '../lib/rating-validation';

describe('rating precision validation', () => {
  it('kiểm tra precision trên giá trị gốc trước khi làm tròn', () => {
    const valid = parseDecimalRating('7.8');
    const invalid = parseDecimalRating('7.777');

    expect(valid).toBe(7.8);
    expect(valid !== null && hasAtMostOneDecimalPlace(valid)).toBe(true);
    expect(invalid).toBe(7.777);
    expect(invalid !== null && hasAtMostOneDecimalPlace(invalid)).toBe(false);
  });
});
