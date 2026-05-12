import type { DetailedPosition, PositionGroup } from './types';

export const POSITION_GROUPS: PositionGroup[] = ['GK', 'DF', 'MF', 'FW'];

export const DETAILED_POSITIONS_BY_GROUP: Record<PositionGroup, DetailedPosition[]> = {
  GK: ['GK'],
  DF: ['CB', 'LB', 'LWB', 'RB', 'RWB'],
  MF: ['CM', 'CDM', 'CAM', 'LM', 'RM'],
  FW: ['ST', 'CF', 'LW', 'RW']
};

const ALL_DETAILED_POSITIONS = new Set<DetailedPosition>(
  Object.values(DETAILED_POSITIONS_BY_GROUP).flat()
);

export function isPositionGroup(value: unknown): value is PositionGroup {
  return typeof value === 'string' && POSITION_GROUPS.includes(value as PositionGroup);
}

export function getDetailedPositionsByGroup(group: PositionGroup): DetailedPosition[] {
  return DETAILED_POSITIONS_BY_GROUP[group];
}

export function isDetailedPosition(value: unknown): value is DetailedPosition {
  return typeof value === 'string' && ALL_DETAILED_POSITIONS.has(value as DetailedPosition);
}

export function normalizeDetailedPosition(value: unknown): DetailedPosition | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  return isDetailedPosition(normalized) ? normalized : undefined;
}

export function isDetailedPositionForGroup(
  group: PositionGroup,
  detailedPosition: unknown
): detailedPosition is DetailedPosition {
  return (
    isDetailedPosition(detailedPosition) &&
    DETAILED_POSITIONS_BY_GROUP[group].includes(detailedPosition)
  );
}

export function matchesPositionFilter(
  playerPosition: unknown,
  group: PositionGroup,
  detailedPosition?: DetailedPosition
): boolean {
  const normalizedPlayerPosition = normalizeDetailedPosition(playerPosition);
  if (!normalizedPlayerPosition) {
    return false;
  }

  if (detailedPosition) {
    return normalizedPlayerPosition === detailedPosition;
  }

  return DETAILED_POSITIONS_BY_GROUP[group].includes(normalizedPlayerPosition);
}

export function filterPlayersByPosition<T extends { position: string }>(
  players: T[],
  group: PositionGroup,
  detailedPosition?: DetailedPosition
): T[] {
  return players.filter((player) =>
    matchesPositionFilter(player.position, group, detailedPosition)
  );
}