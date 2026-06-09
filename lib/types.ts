export type MatchResult = 'Win' | 'Draw' | 'Loss';
export type PositionGroup = 'GK' | 'DF' | 'MF' | 'FW';
export type TrendStatus = 'UP' | 'STABLE' | 'DOWN';
export type StabilityLevel = 'STABLE' | 'UNSTABLE' | 'VOLATILE';
export type MomentumStatus = 'HOT' | 'NORMAL' | 'COLD';
export type PredictionConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type RecommendationAction = 'KEEP' | 'MONITOR' | 'BENCH' | 'SELL' | 'REPLACE';
export type DetailedPosition =
  | 'GK'
  | 'CB'
  | 'LB'
  | 'LWB'
  | 'RB'
  | 'RWB'
  | 'CM'
  | 'CDM'
  | 'CAM'
  | 'LM'
  | 'RM'
  | 'ST'
  | 'CF'
  | 'LW'
  | 'RW';

export interface PlayerSeed {
  playerId: string;
  name: string;
  cardSeason: string; // e.g., "21CU", "22EA" - represents the card season/version
  position: string;
}

export interface PlayerSummary extends PlayerSeed {}

export interface PlayerMetadataItem {
  PK: string;
  SK: 'METADATA';
  Name: string;
  CardSeason: string; // Card season/version
  Position: string;
}

export interface StoredMatchItem {
  PK: string;
  SK: string;
  MatchDate?: string;
  CreatedAt?: string;
  Score: number;
  IsStarter: boolean;
  Result: MatchResult;
  PositionGroup?: PositionGroup;
  DetailedPosition?: DetailedPosition;
  YellowCards?: number;
  RedCards?: number;
  Fouls?: number;
  IsBigWin?: boolean;
  IsBigLoss?: boolean;
}

export interface RecentMatch {
  sk: string;
  matchDate?: string;
  createdAt?: string;
  score: number;
  result: MatchResult;
  positionGroup?: PositionGroup;
  detailedPosition?: DetailedPosition;
  yellowCards?: number;
  redCards?: number;
  fouls?: number;
  repeatedOffenses?: number;
  isBigWin?: boolean;
  isBigLoss?: boolean;
}

export interface PlayerStatusTrackingResponse {
  playerId: string;
  name: string;
  matchCount: number;
  status: 'Đang theo dõi';
  message: string;
}

export interface PlayerStatusEvaluatedResponse {
  playerId: string;
  name: string;
  averageScore: number;
  currentFormScore: number;
  wmaScore: number;
  matchCount: number;
  status: 'Star Player' | 'Stable' | 'Under Review' | 'Fraud';
  action: string;
  color: 'green' | 'white' | 'orange' | 'red';
  trendValue: number;
  trendStatus: TrendStatus;
  variance: number;
  stabilityLevel: StabilityLevel;
  momentum: number;
  momentumStatus: MomentumStatus;
  predictedScore: number;
  confidence: number;
  confidenceLevel: PredictionConfidenceLevel;
  lossStreak: number;
  riskScore: number;
  riskLevel: RiskLevel;
  fraudRisk: boolean;
  fraudReasons: string[];
  recommendation: RecommendationAction;
  recommendationReason: string;
  adjustedAverageScore: number;
  bigWinCountLast5: number;
  bigLossCountLast5: number;
  bigWinRate: number;
  bigLossRate: number;
  matchImpactAvg: number;
  recentMatches: RecentMatch[];
}

export type PlayerStatusResponse =
  | PlayerStatusTrackingResponse
  | PlayerStatusEvaluatedResponse;

export interface PlayerAssessment {
  averageScore: number;
  status: PlayerStatusEvaluatedResponse['status'];
  action: string;
  color: PlayerStatusEvaluatedResponse['color'];
}

export interface PerformanceAnalysis {
  averageScore: number;
  currentFormScore: number;
  wmaScore: number;
  trendValue: number;
  trendStatus: TrendStatus;
  variance: number;
  stabilityLevel: StabilityLevel;
  momentum: number;
  momentumStatus: MomentumStatus;
  predictedScore: number;
  confidence: number;
  confidenceLevel: PredictionConfidenceLevel;
  lossStreak: number;
  riskScore: number;
  riskLevel: RiskLevel;
  fraudRisk: boolean;
  fraudReasons: string[];
  recommendation: RecommendationAction;
  recommendationReason: string;
  disciplineScore?: number;
  aggressionIndex?: number;
  disciplineTrend?: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
  adjustedAverageScore: number;
  bigWinCountLast5: number;
  bigLossCountLast5: number;
  bigWinRate: number;
  bigLossRate: number;
  matchImpactAvg: number;
}

export interface RatingPayload {
  playerId: string;
  score: number;
  isStarter: boolean;
  result: MatchResult;
  positionGroup: PositionGroup;
  detailedPosition: DetailedPosition;
  yellowCards?: number;
  redCards?: number;
  fouls?: number;
  isBigWin?: boolean;
  isBigLoss?: boolean;
}

/**
 * Match model - represents a single match
 * PK: MATCH#{matchId}
 * SK: METADATA
 */
export interface Match {
  id: string;
  matchDate: string; // YYYY-MM-DD
  opponentName?: string;
  myScore: number;
  opponentScore: number;
  result: 'WIN' | 'DRAW' | 'LOSE';
  isBigWin?: boolean;
  isBigLoss?: boolean;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * StoredMatch - DynamoDB item for Match
 */
export interface StoredMatch {
  PK: string; // MATCH#{matchId}
  SK: 'METADATA';
  MatchDate: string;
  OpponentName?: string;
  MyScore: number;
  OpponentScore: number;
  Result: 'WIN' | 'DRAW' | 'LOSE';
  IsBigWin?: boolean;
  IsBigLoss?: boolean;
  Note?: string;
  CreatedAt: string;
  UpdatedAt: string;
}

/**
 * PlayerMatchRating model - represents a player's rating for a single match
 * PK: MATCH#{matchId}
 * SK: RATING#{playerId}
 */
export interface PlayerMatchRating {
  id: string;
  matchId: string;
  playerId: string;
  rating: number; // 1-10
  position?: DetailedPosition;
  yellowCards?: number;
  redCards?: number;
  fouls?: number;
  goals?: number;
  assists?: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * StoredPlayerMatchRating - DynamoDB item for PlayerMatchRating
 */
export interface StoredPlayerMatchRating {
  PK: string; // MATCH#{matchId}
  SK: string; // RATING#{playerId}
  PlayerId: string;
  Rating: number;
  Position?: DetailedPosition;
  YellowCards?: number;
  RedCards?: number;
  Fouls?: number;
  Goals?: number;
  Assists?: number;
  Note?: string;
  CreatedAt: string;
  UpdatedAt: string;
}

/**
 * CreateMatchPayload - for POST /api/matches
 */
export interface CreateMatchPayload {
  matchDate: string; // YYYY-MM-DD
  opponentName?: string;
  myScore: number;
  opponentScore: number;
  note?: string;
}

/**
 * SaveMatchRatingsPayload - for POST /api/matches/:matchId/ratings
 */
export interface SaveMatchRatingsPayload {
  ratings: Array<{
    playerId: string;
    rating: number;
    position?: DetailedPosition;
    yellowCards?: number;
    redCards?: number;
    fouls?: number;
    goals?: number;
    assists?: number;
    note?: string;
  }>;
}
