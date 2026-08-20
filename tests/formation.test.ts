import { describe, expect, it } from 'vitest';
import { isValidFormation, normalizeFormation } from '../lib/formation';

describe('formation validation', () => {
  it('accepts standard and custom formations whose lines total ten players', () => {
    for (const value of ['4-5-1', '4-1-4-1', '4-3-3-0', '3-2-4-1']) expect(isValidFormation(value)).toBe(true);
  });

  it('normalizes spaces and rejects malformed formations', () => {
    expect(normalizeFormation(' 4 - 1 - 4 - 1 ')).toBe('4-1-4-1');
    for (const value of ['', 'custom', '4-4', '4-4-3', '4--5-1']) expect(isValidFormation(value)).toBe(false);
  });
});
