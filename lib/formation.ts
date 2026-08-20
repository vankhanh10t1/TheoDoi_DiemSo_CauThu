export function normalizeFormation(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.trim().replace(/\s+/g, '') || undefined;
}

export function isValidFormation(value: unknown): value is string {
  const normalized = normalizeFormation(value);
  return !!normalized && /^\d(?:-\d){2,4}$/.test(normalized) && normalized.split('-').reduce((sum, part) => sum + Number(part), 0) === 10;
}

export const FORMATION_HELP = 'Nhập 3–5 tuyến, ngăn cách bằng dấu gạch ngang và tổng bằng 10, ví dụ 4-5-1 hoặc 3-2-4-1.';
