import { describe, expect, it } from 'vitest';
import { displayMatchTag, normalizeMatchTag, validateMatchTag } from '../lib/match-tags';

describe('match tags', () => {
  it('normalizes whitespace', () => expect(normalizeMatchTag('  Mùa   1  ')).toBe('Mùa 1'));
  it('uses the legacy fallback', () => expect(displayMatchTag('   ')).toBe('Chưa phân loại'));
  it('enforces 80 characters while allowing empty tags', () => {
    expect(validateMatchTag('')).toBe(true);
    expect(validateMatchTag('a'.repeat(80))).toBe(true);
    expect(validateMatchTag('a'.repeat(81))).toBe(false);
  });
});
