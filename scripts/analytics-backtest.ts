import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderBacktestMarkdown, runWalkForwardBacktest } from '../lib/analytics/backtest';
import { ANONYMOUS_BACKTEST_FIXTURE } from '../tests/fixtures/player-backtest';

try {
  const report = runWalkForwardBacktest(ANONYMOUS_BACKTEST_FIXTURE, { generatedAt: new Date().toISOString() });
  const directory = resolve(process.cwd(), 'reports');
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, 'backtest-player-evaluation.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(resolve(directory, 'backtest-player-evaluation.md'), renderBacktestMarkdown(report), 'utf8');
  console.table(report.metrics.filter((metric) => metric.group === 'overall'));
  console.log(`Backtest complete: ${report.samples.length} predictions, ${report.skipped.length} skipped targets.`);
} catch (error) {
  console.error('Player evaluation backtest failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
