export function normalizePlayerName(name: string): string {
  return name.trim().toLowerCase();
}

export function getPlayerNameReservationKey(name: string): { PK: string; SK: 'RESERVATION' } {
  return {
    PK: `PLAYER_NAME#${encodeURIComponent(normalizePlayerName(name))}`,
    SK: 'RESERVATION'
  };
}
