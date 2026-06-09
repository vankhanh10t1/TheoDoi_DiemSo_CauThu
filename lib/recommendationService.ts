import { analyzeRecentMatches } from './analytics/performance';
import { recommendationRank } from './recommendation';
import { sortRecentMatchesNewestFirst } from './match-history';
import type { MatchResult, RecentMatch, RecommendationAction } from './types';

type RecommendationTableItem = {
  PK?: unknown;
  SK?: unknown;
  Name?: unknown;
  CardSeason?: unknown;
  Season?: unknown;
  Position?: unknown;
  Score?: unknown;
  Result?: unknown;
  MatchDate?: unknown;
  CreatedAt?: unknown;
  YellowCards?: unknown;
  RedCards?: unknown;
  Fouls?: unknown;
};

interface RecommendationSourceRecord {
  playerId: string;
  name: string;
  cardSeason: string;
  position: string;
  recentMatches: RecentMatch[];
}

export interface TransferRecommendation {
  playerId: string;
  name: string;
  cardSeason: string;
  position: string;
  status: string;
  averageScore: number;
  wmaScore: number;
  matchCount: number;
  recommendation: RecommendationAction;
  reason: string;
  priority: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  trendValue: number;
  variance: number;
  stabilityLevel: 'STABLE' | 'UNSTABLE' | 'VOLATILE';
  momentum: number;
  momentumStatus: 'HOT' | 'NORMAL' | 'COLD';
  predictedScore: number;
  confidence: number;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  fraudRisk: boolean;
  fraudReasons: string[];
  lossStreak: number;
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
      matchDate: toStringValue(item.MatchDate) || undefined,
      createdAt: toStringValue(item.CreatedAt) || undefined,
      score: item.Score,
      result: item.Result,
      yellowCards: isValidScore(item.YellowCards) ? item.YellowCards : 0,
      redCards: isValidScore(item.RedCards) ? item.RedCards : 0,
      fouls: isValidScore(item.Fouls) ? item.Fouls : 0
    });
    records.set(playerId, existingRecord);
  }

  const recommendations = Array.from(records.values())
    .map((record) => {
      const hasMetadata =
        Boolean(record.cardSeason) || Boolean(record.position) || record.name !== record.playerId;

      if (!hasMetadata) {
        return null;
      }

      const recentMatches = sortRecentMatchesNewestFirst(record.recentMatches).slice(0, 5);

      if (recentMatches.length === 0) {
        return null;
      }

      const analysis = analyzeRecentMatches(recentMatches);

      return {
        playerId: record.playerId,
        name: record.name,
        cardSeason: record.cardSeason,
        position: record.position,
        status:
          analysis.currentFormScore > 8
            ? 'Star Player'
            : analysis.currentFormScore >= 6
              ? 'Stable'
              : analysis.currentFormScore >= 4.5
                ? 'Under Review'
                : 'Fraud',
        averageScore: analysis.averageScore,
        wmaScore: analysis.wmaScore,
        matchCount: recentMatches.length,
        recommendation: analysis.recommendation,
        reason: analysis.recommendationReason,
        priority: recommendationRank(analysis.recommendation),
        trend: analysis.trendStatus,
        trendValue: analysis.trendValue,
        variance: analysis.variance,
        stabilityLevel: analysis.stabilityLevel,
        momentum: analysis.momentum,
        momentumStatus: analysis.momentumStatus,
        predictedScore: analysis.predictedScore,
        confidence: analysis.confidence,
        confidenceLevel: analysis.confidenceLevel,
        riskScore: analysis.riskScore,
        riskLevel: analysis.riskLevel,
        fraudRisk: analysis.fraudRisk,
        fraudReasons: analysis.fraudReasons,
        lossStreak: analysis.lossStreak
      } satisfies TransferRecommendation;
    })
    .filter((recommendation): recommendation is TransferRecommendation => recommendation !== null)
    .sort((a, b) => {
      const rankDiff = recommendationRank(a.recommendation) - recommendationRank(b.recommendation);

      if (rankDiff !== 0) {
        return rankDiff;
      }

      return b.priority - a.priority;
    });

  return recommendations;
}
