'use client';

import { useMemo, useState } from 'react';
import { calculateAdjustedScore, calculateMatchImpact, calculateWMA } from '../lib/analytics/calculations';
import { formatMatchDateValue, getMatchChronologyValue } from '../lib/match-history';
import type { RecentMatch } from '../lib/types';

type Range = '5' | '10' | '20' | 'custom';
type Point = RecentMatch & { label: string; wma: number };

function resultLabel(result: RecentMatch['result']) { return result === 'Win' ? 'Thắng' : result === 'Draw' ? 'Hòa' : 'Thua'; }
function linePath(points: Point[], value: (point: Point) => number, width: number, height: number) {
  if (!points.length) return '';
  const x = (i: number) => 42 + (points.length === 1 ? (width - 64) / 2 : i * (width - 64) / (points.length - 1));
  const y = (score: number) => 12 + (10 - Math.max(0, Math.min(10, score))) * (height - 38) / 10;
  return points.map((point, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(value(point))}`).join(' ');
}

export function TrendDashboard({ matches, prediction }: { matches: RecentMatch[]; prediction?: number }) {
  const [range, setRange] = useState<Range>('5');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const points = useMemo(() => {
    const chronological = [...matches].filter((m) => Number.isFinite(m.score)).sort((a, b) => getMatchChronologyValue(a) - getMatchChronologyValue(b));
    const filtered = range === 'custom' ? chronological.filter((m) => { const day = m.matchDate?.slice(0, 10); return (!from || Boolean(day && day >= from)) && (!to || Boolean(day && day <= to)); }) : chronological.slice(-Number(range));
    return filtered.map((match, index): Point => {
      const adjusted = filtered.slice(Math.max(0, index - 2), index + 1).reverse().map((m) => calculateAdjustedScore(m.score, calculateMatchImpact(m.result, m.isBigWin, m.isBigLoss)));
      return { ...match, label: formatMatchDateValue(match), wma: calculateWMA(adjusted) };
    });
  }, [from, matches, range, to]);
  const kpi = useMemo(() => {
    const wins = points.filter((m) => m.result === 'Win').length;
    return { wins, draws: points.filter((m) => m.result === 'Draw').length, losses: points.filter((m) => m.result === 'Loss').length, goals: points.reduce((s, m) => s + (m.goals ?? 0), 0), assists: points.reduce((s, m) => s + (m.assists ?? 0), 0), average: points.length ? points.reduce((s, m) => s + m.score, 0) / points.length : 0, winRate: points.length ? wins * 100 / points.length : 0, wma: points.at(-1)?.wma };
  }, [points]);
  const width = 760, height = 270;
  const predictionPath = Number.isFinite(prediction) && points.length ? linePath(points, () => prediction as number, width, height) : '';
  return <section className="trend-dashboard" aria-labelledby="trend-heading">
    <div className="trend-heading-row"><div><p className="panel-kicker">Phân tích xu hướng</p><h3 id="trend-heading">Phong độ theo từng trận</h3></div><div className="trend-range" role="group" aria-label="Phạm vi dữ liệu">
      {(['5', '10', '20'] as Range[]).map((value) => <button type="button" key={value} className={range === value ? 'active' : ''} onClick={() => setRange(value)}>{value} trận</button>)}
      <button type="button" className={range === 'custom' ? 'active' : ''} onClick={() => setRange('custom')}>Khoảng ngày</button></div></div>
    {range === 'custom' ? <div className="trend-dates"><label>Từ ngày<input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label><label>Đến ngày<input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label></div> : null}
    <div className="trend-kpis"><div><span>Số trận</span><strong>{points.length}</strong></div><div><span>Thắng</span><strong>{kpi.wins}</strong></div><div><span>Hòa</span><strong>{kpi.draws}</strong></div><div><span>Thua</span><strong>{kpi.losses}</strong></div><div><span>Tỷ lệ thắng</span><strong>{kpi.winRate.toFixed(0)}%</strong></div><div><span>Bàn thắng</span><strong>{kpi.goals}</strong></div><div><span>Kiến tạo</span><strong>{kpi.assists}</strong></div><div><span>Rating TB</span><strong>{points.length ? kpi.average.toFixed(1) : '—'}</strong></div><div><span>WMA hiện tại</span><strong>{kpi.wma?.toFixed(1) ?? '—'}</strong></div></div>
    {!points.length ? <div className="trend-empty">Chưa có dữ liệu trong phạm vi đã chọn.</div> : <div className="trend-chart-wrap"><div className="trend-legend"><span className="rating">Rating</span><span className="wma">WMA</span>{predictionPath ? <span className="prediction">Dự đoán hiện tại</span> : null}</div><svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ rating, WMA và dự đoán theo từng trận">
      {[0, 2, 4, 6, 8, 10].map((tick) => { const y = 12 + (10 - tick) * (height - 38) / 10; return <g key={tick}><line x1="42" x2={width - 22} y1={y} y2={y} className="grid-line" /><text x="32" y={y + 4} textAnchor="end">{tick}</text></g>; })}
      {predictionPath ? <path d={predictionPath} className="chart-line prediction-line" /> : null}<path d={linePath(points, (p) => p.wma, width, height)} className="chart-line wma-line" /><path d={linePath(points, (p) => p.score, width, height)} className="chart-line rating-line" />
      {points.map((p, i) => { const x = 42 + (points.length === 1 ? (width - 64) / 2 : i * (width - 64) / (points.length - 1)); const y = 12 + (10 - p.score) * (height - 38) / 10; return <circle key={p.sk} cx={x} cy={y} r="5" className="rating-dot"><title>{`${p.label} · ${resultLabel(p.result)} · Rating ${p.score.toFixed(1)} · WMA ${p.wma.toFixed(1)}`}</title></circle>; })}
    </svg><div className="trend-axis-labels">{points.map((p) => <span key={p.sk} title={p.label}>{p.label.slice(0, 5)}</span>)}</div></div>}
  </section>;
}
