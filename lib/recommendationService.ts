import { generateTransferRecommendation, rankTransferRecommendations, type TransferRecommendation } from './transferEngine';
import type { MatchResult, RecentMatch } from './types';

type RecommendationTableItem = {
  PK?: unknown;
  SK?: unknown;
  Name?: unknown;
  CardSeason?: unknown;
  Season?: unknown;
  Position?: unknown;
  Score?: unknown;
  Result?: unknown;
};

interface RecommendationSourceRecord {
  playerId: string;
  name: string;
  cardSeason: string;
  position: string;
  recentMatches: RecentMatch[];
}

function isMatchResult(value: unknown): value is MatchResult {
  return value === 'Win' || value === 'Draw' || value === 'Loss';
}

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toPlayerId(pk: string): string {
  return pk.replace(/^PLAYER#/, '');
}

function isValidScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function buildRecommendationsFromTableItems(
  items: RecommendationTableItem[]
): TransferRecommendation[] {
  const records = new Map<string, RecommendationSourceRecord>();

  for (const item of items) {
    const pk = toStringValue(item.PK);
    const sk = toStringValue(item.SK);

    if (!pk.startsWith('PLAYER#')) {
      continue;
    }

    const playerId = toPlayerId(pk);
    const existingRecord = records.get(playerId) ?? {
      playerId,
      name: playerId,
      cardSeason: '',
      position: '',
      recentMatches: []
    };

    if (sk === 'METADATA') {
      existingRecord.name = toStringValue(item.Name) || existingRecord.name;
      existingRecord.cardSeason = toStringValue(item.CardSeason) || toStringValue(item.Season);
      existingRecord.position = toStringValue(item.Position) || existingRecord.position;
      records.set(playerId, existingRecord);
      continue;
    }

    if (!sk.startsWith('MATCH#')) {
      continue;
    }

    if (!isValidScore(item.Score) || !isMatchResult(item.Result)) {
      continue;
    }

    existingRecord.recentMatches.push({
      sk,
      score: item.Score,
      result: item.Result
    });
    records.set(playerId, existingRecord);
  }

  const recommendations = Array.from(records.values())
    .map((record) => {
      // Only include players that have METADATA present (avoid showing pure-fake IDs)
      const hasMetadata =
        Boolean(record.cardSeason) || Boolean(record.position) || record.name !== record.playerId;

      if (!hasMetadata) {
        return null;
      }

      const recentMatches = [...record.recentMatches]
        .sort((a, b) => b.sk.localeCompare(a.sk))
        .slice(0, 5);

      return generateTransferRecommendation({
        playerId: record.playerId,
        name: record.name,
        cardSeason: record.cardSeason,
        position: record.position,
        recentMatches
      });
    })
    .filter((recommendation): recommendation is TransferRecommendation => recommendation !== null);

  return rankTransferRecommendations(recommendations);
}
