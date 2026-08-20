import type { AnalysisWindow, PositionGroup, RecentMatch } from '../types';
import { getMatchChronologyValue } from '../match-history';
import { analyzeRecentMatches } from './performance';
import { calculateAverageScore, calculateWMA } from './calculations';
import { MIN_BACKTEST_HISTORY } from './config';

export const BACKTEST_WINDOWS: readonly AnalysisWindow[] = [5, 10, 20];
export const BACKTEST_MODELS = ['current-heuristic', 'last-rating', 'rolling-average', 'wma-only'] as const;
export type BacktestModelName = typeof BACKTEST_MODELS[number];

export interface BacktestPlayer {
  playerId: string;
  playerName: string;
  positionGroup?: PositionGroup;
  matches: RecentMatch[];
}

export interface BacktestFilters {
  season?: string;
  competition?: string;
  matchType?: string;
  positionGroup?: PositionGroup;
}

export interface BacktestSample {
  playerId: string;
  playerName: string;
  matchId: string;
  matchDate?: string;
  positionGroup: PositionGroup | 'UNKNOWN';
  season?: string;
  competition?: string;
  matchType?: string;
  window: AnalysisWindow;
  predictedRating: number;
  actualRating: number;
  error: number;
  absoluteError: number;
  modelName: BacktestModelName;
}

export interface SkippedBacktestSample {
  playerId: string;
  matchId: string;
  window: AnalysisWindow;
  reason: string;
}

export interface BacktestMetric {
  group: string;
  value: string;
  modelName: BacktestModelName;
  sampleSize: number;
  mae: number | null;
  meanError: number | null;
}

export interface BacktestReport {
  generatedAt: string;
  samples: BacktestSample[];
  skipped: SkippedBacktestSample[];
  metrics: BacktestMetric[];
}

const round = (value: number) => Number(value.toFixed(2));

function matchesFilters(match: RecentMatch, player: BacktestPlayer, filters: BacktestFilters): boolean {
  const position = match.positionGroup ?? player.positionGroup;
  return (!filters.season || match.season === filters.season)
    && (!filters.competition || match.competition === filters.competition)
    && (!filters.matchType || match.matchType === filters.matchType)
    && (!filters.positionGroup || position === filters.positionGroup);
}

function predict(model: BacktestModelName, historyNewestFirst: RecentMatch[], window: AnalysisWindow, positionGroup?: PositionGroup): number {
  if (model === 'last-rating') return historyNewestFirst[0].score;
  if (model === 'rolling-average') return calculateAverageScore(historyNewestFirst.map((match) => match.score));
  if (model === 'wma-only') return calculateWMA(historyNewestFirst.map((match) => match.score));
  return analyzeRecentMatches(historyNewestFirst, { window, positionGroup }).predictedScore;
}

function metricFor(group: string, value: string, modelName: BacktestModelName, samples: BacktestSample[]): BacktestMetric {
  const selected = samples.filter((sample) => sample.modelName === modelName);
  return {
    group,
    value,
    modelName,
    sampleSize: selected.length,
    mae: selected.length ? round(selected.reduce((sum, sample) => sum + sample.absoluteError, 0) / selected.length) : null,
    meanError: selected.length ? round(selected.reduce((sum, sample) => sum + sample.error, 0) / selected.length) : null
  };
}

export function aggregateBacktestMetrics(samples: BacktestSample[]): BacktestMetric[] {
  const dimensions: Array<[string, (sample: BacktestSample) => string]> = [
    ['overall', () => 'all'],
    ['position', (sample) => sample.positionGroup],
    ['window', (sample) => String(sample.window)],
    ['season', (sample) => sample.season ?? 'UNCLASSIFIED'],
    ['competition', (sample) => sample.competition ?? 'UNCLASSIFIED'],
    ['matchType', (sample) => sample.matchType ?? 'UNCLASSIFIED']
  ];
  const metrics: BacktestMetric[] = [];
  for (const [group, selector] of dimensions) {
    const values = [...new Set(samples.map(selector))].sort();
    for (const value of values) {
      const grouped = samples.filter((sample) => selector(sample) === value);
      for (const model of BACKTEST_MODELS) metrics.push(metricFor(group, value, model, grouped));
    }
  }
  return metrics;
}

export function runWalkForwardBacktest(
  players: BacktestPlayer[],
  options: { windows?: readonly AnalysisWindow[]; filters?: BacktestFilters; generatedAt?: string } = {}
): BacktestReport {
  const windows = options.windows ?? BACKTEST_WINDOWS;
  const filters = options.filters ?? {};
  const samples: BacktestSample[] = [];
  const skipped: SkippedBacktestSample[] = [];

  for (const player of players) {
    const chronological = player.matches
      .filter((match) => matchesFilters(match, player, filters))
      .map((match, originalIndex) => ({ match, originalIndex }))
      .sort((left, right) => getMatchChronologyValue(left.match) - getMatchChronologyValue(right.match)
        || String(left.match.sk).localeCompare(String(right.match.sk))
        || left.originalIndex - right.originalIndex)
      .map(({ match }) => match);

    for (const window of windows) {
      for (let targetIndex = 0; targetIndex < chronological.length; targetIndex += 1) {
        const target = chronological[targetIndex];
        const history = chronological.slice(Math.max(0, targetIndex - window), targetIndex).reverse();
        if (history.length < MIN_BACKTEST_HISTORY) {
          skipped.push({ playerId: player.playerId, matchId: target.matchId ?? target.sk, window, reason: `requires ${MIN_BACKTEST_HISTORY} prior matches` });
          continue;
        }
        if (!Number.isFinite(target.score)) {
          skipped.push({ playerId: player.playerId, matchId: target.matchId ?? target.sk, window, reason: 'actual rating is missing or invalid' });
          continue;
        }
        const positionGroup = target.positionGroup ?? player.positionGroup;
        for (const modelName of BACKTEST_MODELS) {
          const predictedRating = round(predict(modelName, history, window, positionGroup));
          const error = round(predictedRating - target.score);
          samples.push({
            playerId: player.playerId,
            playerName: player.playerName,
            matchId: target.matchId ?? target.sk,
            matchDate: target.matchDateTime ?? target.matchDate ?? target.createdAt,
            positionGroup: positionGroup ?? 'UNKNOWN',
            season: target.season,
            competition: target.competition,
            matchType: target.matchType,
            window,
            predictedRating,
            actualRating: target.score,
            error,
            absoluteError: round(Math.abs(error)),
            modelName
          });
        }
      }
    }
  }

  return { generatedAt: options.generatedAt ?? new Date().toISOString(), samples, skipped, metrics: aggregateBacktestMetrics(samples) };
}

export function renderBacktestMarkdown(report: BacktestReport): string {
  const rows = report.metrics.map((metric) => `| ${metric.group} | ${metric.value} | ${metric.modelName} | ${metric.sampleSize} | ${metric.mae ?? '-'} | ${metric.meanError ?? '-'} |`).join('\n');
  return `# Player evaluation backtest\n\nGenerated: ${report.generatedAt}\n\n- Prediction samples: ${report.samples.length}\n- Skipped targets: ${report.skipped.length}\n- Method: leakage-safe walk-forward; each target uses only earlier matches.\n\n## Metrics\n\n| Group | Value | Model | N | MAE | Mean error |\n| --- | --- | --- | ---: | ---: | ---: |\n${rows}\n\n## Weight and threshold recommendation\n\nCurrent prediction weights: WMA 0.65, rolling average 0.25, last rating 0.10; trend adjustment 0.08; momentum adjustment 0.04. Current rating thresholds: excellent > 8, average >= 6, poor >= 4.5. Risk thresholds: medium >= 35, high >= 70.\n\nChưa đủ dữ liệu để đề xuất chỉnh weights/threshold. The checked-in anonymous fixture is intended for regression detection, not production calibration.\n\n## Deferred normalization\n\nOpponent names are present but no reliable opponent-strength history exists. Detailed roles are inconsistently populated. Defer opponent-strength adjustment and GK/CB/FB/DM/CM/AM/W/ST role baselines until representative data is available.\n`;
}
