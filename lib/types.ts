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
  Score: number;
  IsStarter: boolean;
  Result: MatchResult;
  PositionGroup?: PositionGroup;
  DetailedPosition?: DetailedPosition;
}

export interface RecentMatch {
  sk: string;
  score: number;
  result: MatchResult;
  positionGroup?: PositionGroup;
  detailedPosition?: DetailedPosition;
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
}

export interface RatingPayload {
  playerId: string;
  score: number;
  isStarter: boolean;
  result: MatchResult;
  positionGroup: PositionGroup;
  detailedPosition: DetailedPosition;
}