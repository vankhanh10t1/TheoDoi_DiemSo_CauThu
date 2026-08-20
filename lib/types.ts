export type MatchResult = 'Win' | 'Draw' | 'Loss';
export type PositionGroup = 'GK' | 'DF' | 'MF' | 'FW';
export type TrendStatus = 'UP' | 'STABLE' | 'DOWN';
export type StabilityLevel = 'STABLE' | 'UNSTABLE' | 'VOLATILE';
export type MomentumStatus = 'HOT' | 'NORMAL' | 'COLD';
export type PredictionConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type RecommendationAction = 'KEEP' | 'MONITOR' | 'BENCH' | 'SELL' | 'REPLACE';
export type AnalysisWindow = 5 | 10 | 20;
export type ContributionImpact = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export interface AnalysisBreakdownItem {
  key: string;
  label: string;
  value: string;
  meaning: string;
  impact: ContributionImpact;
  contribution?: number;
}

export interface PredictionBacktestItem {
  matchKey: string;
  matchDate?: string;
  predicted: number;
  actual: number;
  error: number;
}

export interface PredictionBacktest {
  sampleSize: number;
  mae: number | null;
  averagePrediction: number | null;
  averageActual: number | null;
  recent: PredictionBacktestItem[];
}
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

export interface RecentMatch {
  sk: string;
  matchId?: string;
  matchDateTime?: string;
  matchDate?: string;
  matchTime?: string;
  createdAt?: string;
  updatedAt?: string;
  score: number;
  result: MatchResult;
  positionGroup?: PositionGroup;
  detailedPosition?: DetailedPosition;
  yellowCards?: number;
  redCards?: number;
  fouls?: number;
  goals?: number;
  assists?: number;
  note?: string;
  repeatedOffenses?: number;
  isBigWin?: boolean;
  isBigLoss?: boolean;
  opponentName?: string;
  prediction?: number;
}

export interface PlayerStatusTrackingResponse {
  playerId: string;
  name: string;
  matchCount: number;
  status: 'NOT_ENOUGH_DATA';
  message: string;
  recentMatches: RecentMatch[];
}

export interface PlayerStatusEvaluatedResponse {
  playerId: string;
  name: string;
  averageScore: number;
  currentFormScore: number;
  wmaScore: number;
  matchCount: number;
  status: 'Star Player' | 'Stable' | 'Under Review' | 'Needs Monitoring' | 'Fraud';
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
  analysisWindow: AnalysisWindow;
  analyzedMatchCount: number;
  breakdown: AnalysisBreakdownItem[];
  backtest: PredictionBacktest;
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
  analysisWindow: AnalysisWindow;
  analyzedMatchCount: number;
  breakdown: AnalysisBreakdownItem[];
  backtest: PredictionBacktest;
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
  matchDate: string; // YYYY-MM-DD, kept for player-centric analytics compatibility
  matchDateTime?: string; // Local ISO datetime, fallback to matchDate/createdAt for old data
  matchTime?: string; // HH:mm, supported for legacy/separate-field data
  opponentName?: string;
  myScore: number;
  opponentScore: number;
  result: 'WIN' | 'DRAW' | 'LOSE';
  isBigWin?: boolean;
  isBigLoss?: boolean;
  note?: string;
  ratingCount?: number;
  averageRating?: number;
  ratingVersion?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * PlayerMatchRating model - represents a player's rating for a single match
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
 * CreateMatchPayload - for POST /api/matches
 */
export interface CreateMatchPayload {
  matchDate: string; // YYYY-MM-DD
  matchDateTime: string; // ISO timestamp captured when the create-match form is submitted
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

export interface PlayerMatchRatingDetail extends PlayerMatchRating {
  playerName: string;
  cardSeason?: string;
  playerPosition?: string;
}
