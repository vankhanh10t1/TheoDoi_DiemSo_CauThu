# Player evaluation backtest

Generated: 2026-08-20T15:24:46.738Z

- Prediction samples: 432
- Skipped targets: 36
- Method: leakage-safe walk-forward; each target uses only earlier matches.

## Metrics

| Group | Value | Model | N | MAE | Mean error |
| --- | --- | --- | ---: | ---: | ---: |
| overall | all | current-heuristic | 108 | 0.36 | -0.11 |
| overall | all | last-rating | 108 | 0.47 | -0.07 |
| overall | all | rolling-average | 108 | 0.45 | -0.3 |
| overall | all | wma-only | 108 | 0.36 | -0.18 |
| position | DF | current-heuristic | 27 | 0.27 | 0.02 |
| position | DF | last-rating | 27 | 0.33 | 0 |
| position | DF | rolling-average | 27 | 0.25 | -0.09 |
| position | DF | wma-only | 27 | 0.23 | -0.05 |
| position | FW | current-heuristic | 27 | 0.63 | -0.06 |
| position | FW | last-rating | 27 | 0.89 | 0 |
| position | FW | rolling-average | 27 | 0.5 | -0.07 |
| position | FW | wma-only | 27 | 0.58 | -0.04 |
| position | GK | current-heuristic | 27 | 0.19 | -0.12 |
| position | GK | last-rating | 27 | 0.34 | -0.12 |
| position | GK | rolling-average | 27 | 0.39 | -0.39 |
| position | GK | wma-only | 27 | 0.24 | -0.24 |
| position | MF | current-heuristic | 27 | 0.36 | -0.29 |
| position | MF | last-rating | 27 | 0.3 | -0.17 |
| position | MF | rolling-average | 27 | 0.65 | -0.65 |
| position | MF | wma-only | 27 | 0.38 | -0.38 |
| window | 10 | current-heuristic | 36 | 0.36 | -0.12 |
| window | 10 | last-rating | 36 | 0.47 | -0.07 |
| window | 10 | rolling-average | 36 | 0.48 | -0.33 |
| window | 10 | wma-only | 36 | 0.36 | -0.18 |
| window | 20 | current-heuristic | 36 | 0.36 | -0.12 |
| window | 20 | last-rating | 36 | 0.47 | -0.07 |
| window | 20 | rolling-average | 36 | 0.48 | -0.34 |
| window | 20 | wma-only | 36 | 0.36 | -0.18 |
| window | 5 | current-heuristic | 36 | 0.36 | -0.09 |
| window | 5 | last-rating | 36 | 0.47 | -0.07 |
| window | 5 | rolling-average | 36 | 0.38 | -0.23 |
| window | 5 | wma-only | 36 | 0.35 | -0.17 |
| season | 2025-26 | current-heuristic | 36 | 0.49 | -0.16 |
| season | 2025-26 | last-rating | 36 | 0.53 | -0.13 |
| season | 2025-26 | rolling-average | 36 | 0.5 | -0.24 |
| season | 2025-26 | wma-only | 36 | 0.48 | -0.2 |
| season | 2026-27 | current-heuristic | 72 | 0.3 | -0.09 |
| season | 2026-27 | last-rating | 72 | 0.43 | -0.04 |
| season | 2026-27 | rolling-average | 72 | 0.42 | -0.33 |
| season | 2026-27 | wma-only | 72 | 0.3 | -0.16 |
| competition | Cup | current-heuristic | 24 | 0.32 | -0.26 |
| competition | Cup | last-rating | 24 | 0.44 | -0.16 |
| competition | Cup | rolling-average | 24 | 0.32 | -0.27 |
| competition | Cup | wma-only | 24 | 0.27 | -0.2 |
| competition | League | current-heuristic | 84 | 0.37 | -0.07 |
| competition | League | last-rating | 84 | 0.47 | -0.05 |
| competition | League | rolling-average | 84 | 0.48 | -0.31 |
| competition | League | wma-only | 84 | 0.38 | -0.17 |
| matchType | CUP | current-heuristic | 24 | 0.32 | -0.26 |
| matchType | CUP | last-rating | 24 | 0.44 | -0.16 |
| matchType | CUP | rolling-average | 24 | 0.32 | -0.27 |
| matchType | CUP | wma-only | 24 | 0.27 | -0.2 |
| matchType | LEAGUE | current-heuristic | 84 | 0.37 | -0.07 |
| matchType | LEAGUE | last-rating | 84 | 0.47 | -0.05 |
| matchType | LEAGUE | rolling-average | 84 | 0.48 | -0.31 |
| matchType | LEAGUE | wma-only | 84 | 0.38 | -0.17 |

## Weight and threshold recommendation

Current prediction weights: WMA 0.65, rolling average 0.25, last rating 0.10; trend adjustment 0.08; momentum adjustment 0.04. Current rating thresholds: excellent > 8, average >= 6, poor >= 4.5. Risk thresholds: medium >= 35, high >= 70.

Chưa đủ dữ liệu để đề xuất chỉnh weights/threshold. The checked-in anonymous fixture is intended for regression detection, not production calibration.

## Deferred normalization

Opponent names are present but no reliable opponent-strength history exists. Detailed roles are inconsistently populated. Defer opponent-strength adjustment and GK/CB/FB/DM/CM/AM/W/ST role baselines until representative data is available.
