import type { PositionGroup, RecentMatch, WeightProfile } from '../types';

export const DEFAULT_WEIGHT_PROFILE: WeightProfile = 'WMA';
export const WEIGHT_PROFILE_OPTIONS: readonly WeightProfile[] = ['WMA', 'DECAY'];
export const WEIGHT_PROFILES = {
  WMA: { label: 'WMA', recentWeights: [0.5, 0.3, 0.2], tailDecay: 0.6 },
  DECAY: { label: 'Decay', decayRate: 0.82 }
} as const;
export const PARTICIPATION_CONFIG = {
  fallbackMinutes: 90, fullMatchMinutes: 90, starterBonus: 0.08, minimumWeight: 0.2,
  lowMinutesThreshold: 30, reliablePer90Minutes: 270, minimumRecommendationMinutes: 180,
  minimumEffectiveMatches: 2.5
} as const;
export const POSITION_PROFILES = {
  GK: { rating: 0.62, stability: 0.25, discipline: 0.13, momentum: 0 },
  DF: { rating: 0.58, stability: 0.22, discipline: 0.2, momentum: 0 },
  MF: { rating: 0.64, stability: 0.16, discipline: 0.08, momentum: 0.12 },
  FW: { rating: 0.65, stability: 0.1, discipline: 0.05, momentum: 0.2 },
  DEFAULT: { rating: 0.65, stability: 0.15, discipline: 0.1, momentum: 0.1 }
} as const;
export function normalizeWeightProfile(value?: string | null): WeightProfile {
  return value?.toUpperCase() === 'DECAY' ? 'DECAY' : DEFAULT_WEIGHT_PROFILE;
}
export function resolvePositionGroup(matches: RecentMatch[], fallback?: PositionGroup): PositionGroup | 'DEFAULT' {
  return fallback ?? matches.find((match) => match.positionGroup)?.positionGroup ?? 'DEFAULT';
}
export function getParticipationWeight(match: RecentMatch): number {
  if (typeof match.minutesPlayed !== 'number' || !Number.isFinite(match.minutesPlayed)) return 1;
  const minuteShare = Math.max(0, Math.min(1, match.minutesPlayed / PARTICIPATION_CONFIG.fullMatchMinutes));
  const starterBonus = match.isStarter === true ? PARTICIPATION_CONFIG.starterBonus : 0;
  return Number(Math.max(PARTICIPATION_CONFIG.minimumWeight, Math.min(1, minuteShare + starterBonus)).toFixed(3));
}
