# Upgrade Analytics Engine — Performance & Discipline Intelligence

Refactor kiến trúc từ "pure performance tracking" thành một football intelligence engine, mở rộng để đánh giá performance, discipline, stability, behavior risk và đưa ra recommendation thông minh.

## Mục tiêu

- Thay `average` bằng hệ thống đánh giá có trọng số.
- Thêm mô-đun `Discipline` và chỉ số `Aggression`.
- Mở rộng lớp feature-engineering để làm nguồn dữ liệu cho prediction và risk engines.
- Đảm bảo kiến trúc production-ready, TypeScript strict, modular và testable.

---

## 1. Weighted Evaluation Engine

Mô tả: thay simple average bằng weighted evaluation.

Formula:
FinalEvaluation = 0.7 * PerformanceScore + 0.2 * DisciplineScore + 0.1 * StabilityScore

API (TypeScript):
```ts
type FinalEvaluationInput = {
	performanceScore: number;
	disciplineScore: number;
	stabilityScore: number;
}

function calculateFinalEvaluation(input: FinalEvaluationInput): number
```

---

## 2. Discipline Engine

Inputs: `yellowCards`, `redCards`, `fouls`, `repeatedOffenses` (per match / per period)

Output shape:
```ts
type DisciplineResult = {
	disciplineScore: number; // normalized 0..100
	disciplineLevel: "GOOD" | "AVERAGE" | "POOR";
}

function calculateDisciplineScore(stats: {
	yellowCards: number;
	redCards: number;
	fouls: number;
	repeatedOffenses?: number;
	position?: string;
}): DisciplineResult
```

---

## 3. Context-Aware Card Penalty

Penalty thay đổi theo vị trí — cấu hình `positionPenaltyMap` có thể inject được từ config:

```ts
type PositionPenaltyMap = Record<string, { yellowWeight: number; redWeight: number }>;
```

Ví dụ: `CDM/CB` giảm yellow penalty, `ST` trung bình, `GK` tăng red penalty.

---

## 4. Aggression Index

Formula:
AggressionIndex = (fouls * 0.5) + (yellowCards * 2) + (redCards * 5)

API:
```ts
type AggressionResult = { aggressionIndex: number; aggressionLevel: "LOW" | "MEDIUM" | "HIGH" };
function calculateAggressionIndex(stats: { fouls: number; yellowCards: number; redCards: number; }): AggressionResult
```

---

## 5. Discipline Trend

Theo dõi chuỗi thẻ/vi phạm qua các trận để xác định trend: `IMPROVING` | `STABLE` | `DETERIORATING`.

API:
```ts
type Trend = "IMPROVING" | "STABLE" | "DETERIORATING";
function calculateDisciplineTrend(history: Array<{ matchId: string; yellow: number; red: number; fouls: number; }>): Trend
```

---

## 6. Stability Engine Expansion

Mở rộng từ variance đơn giản thành:
- `performanceVariance`
- `disciplineVariance`

API:
```ts
function calculatePerformanceVariance(scores: number[]): number;
function calculateDisciplineVariance(series: number[]): number;
```

Interpretation: kết hợp variance và trend để ra kết luận `reliable` | `risky` | `emotionally_unstable`.

---

## 7. Fraud Detection V2

Hybrid ruleset (configurable thresholds):
IF performanceTrend === DOWN && variance HIGH && disciplineScore LOW && redRate HIGH && lossStreak >= 3 => `FRAUD_ALERT`.

API:
```ts
function evaluateFraudRisk(features: Record<string, number | string>): { fraudAlert: boolean; score: number }
```

---

## 8. Prediction Engine Inputs

Feature list to expose from Feature Engineering layer:
- avg_score, weighted_average, variance, trend, discipline_score, yellow_rate, red_rate, aggression_index, loss_streak, starter_ratio, momentum

Thiết kế: trả về một `FeatureVector` interface, dễ mở rộng, document rõ ràng.

---

## 9. Risk Scoring System V2

Risk factors: performance drop, discipline issues, variance, red frequency, losing streak.

API:
```ts
type RiskResult = { riskScore: number; riskLevel: "LOW" | "MEDIUM" | "HIGH" };
function calculateRiskScore(features: Record<string, number>): RiskResult
```

---

## 10. Recommendation Engine V2

Recommendations dựa trên performance, discipline, consistency, aggression.

API:
```ts
type Recommendation = "keep_monitoring" | "bench" | "rotation_candidate" | "risky_starter" | "core_player" | "transfer_candidate";
function generatePlayerRecommendation(features: Record<string, number | string>): { recommendation: Recommendation; reason: string[] }
```

---

## 11. Feature Engineering Layer

Centralize feature calculation trong một module `feature-engineering`.
Outputs (tối thiểu): `weighted_avg`, `trend`, `variance`, `yellow_rate`, `red_rate`, `aggression_index`, `discipline_score`, `loss_streak`, `consistency`, `momentum`.

Pipeline:
Raw Match Data → Feature Engineering → Performance Engine → Discipline Engine → Prediction Engine → Risk Engine → Recommendation Engine

---

## 12. Player Archetype Classification (Optional)

Ví dụ archetypes: `Aggressive Winner`, `Emotional Liability`, `Stable Core`, `High Variance Talent`, `Tactical Fouler`.

API:
```ts
function classifyPlayerArchetype(features: Record<string, number | string>): { archetype: string; confidence: number }
```

---

## 13. UI / Data Changes

Data inputs cần thêm vào match entry UI: `yellowCards`, `redCards`, `fouls`.

Analytics UI cần hiển thị: `disciplineScore`, `aggressionIndex`, `archetype`, `fraudAlert`, `disciplineTrend`.

Remove: loại bỏ hiển thị `player code` trong entry flow dropdown và `ID` field khỏi squad UI.

---

## Implementation notes & suggested file map

- Feature engineering module: `lib/recommendation/featureEngineering.ts` (hoặc `lib/featureEngineering/index.ts`)
- Discipline & aggression: `lib/analytics/discipline.ts`
- Evaluation & risk: `lib/analytics/evaluation.ts`, `lib/analytics/risk.ts`
- Prediction inputs: `lib/prediction/index.ts` (consume feature vector)
- Tests: `tests/discipline.test.ts`, `tests/featureEngineering.test.ts`

---

## Requirements checklist

- Production-style architecture (DI-friendly, config-driven)
- Reusable analytics services (pure functions + small classes)
- TypeScript strict typing
- Configurable thresholds (avoid hardcoding)
- Modular & extensible
- Mobile-friendly UI considerations
- Cập nhật phần Architecture trong README

---

## Next steps (tactical)

1. Implement `feature-engineering` module and unit tests.
2. Implement `calculateDisciplineScore` + `calculateAggressionIndex` and tests.
3. Wire into `recommendationService` and update API routes.

If muốn, tôi có thể tiếp tục và tạo các file TypeScript mẫu và test harness.
