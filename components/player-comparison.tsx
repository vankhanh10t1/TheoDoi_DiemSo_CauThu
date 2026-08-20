'use client';

import { useMemo, useState } from 'react';
import { useAppContext } from './app-context';
import { getPositionGroup } from '../lib/positions';
import type { ComparisonPlayer } from '../lib/analytics/comparison';

type Response = { players: ComparisonPlayer[]; imbalanceWarning: string | null; message?: string };
const colors = ['#0f7d52', '#7067cf', '#d19b00', '#c73a39'];
const radarMetrics = [
  ['average', 'Rating'], ['wma', 'WMA'], ['trend', 'Xu hướng'], ['stability', 'Ổn định'],
  ['momentum', 'Đà'], ['discipline', 'Kỷ luật'], ['safety', 'An toàn'], ['prediction', 'Dự đoán']
] as const;
const tableMetrics = [
  ['average', 'Rating trung bình', true], ['wma', 'WMA', true], ['trend', 'Xu hướng', true], ['variance', 'Độ dao động', false],
  ['momentum', 'Momentum', true], ['goalsPerMatch', 'Bàn/trận', true], ['assistsPerMatch', 'Kiến tạo/trận', true],
  ['cardsPerMatch', 'Điểm thẻ/trận', false], ['foulsPerMatch', 'Lỗi/trận', false], ['discipline', 'Kỷ luật', true],
  ['risk', 'Risk score', false], ['prediction', 'Dự đoán', true]
] as const;

function Radar({ players }: { players: ComparisonPlayer[] }) {
  const center = 160, radius = 120;
  const point = (index: number, value: number) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / radarMetrics.length;
    const r = radius * value / 100;
    return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
  };
  return <div className="comparison-radar-wrap"><svg viewBox="0 0 320 320" role="img" aria-label="Biểu đồ radar so sánh cầu thủ">
    {[25, 50, 75, 100].map(level => <polygon key={level} className="radar-grid" points={radarMetrics.map((_, i) => point(i, level)).join(' ')} />)}
    {radarMetrics.map(([key, label], i) => <g key={key}><line className="radar-axis" x1={center} y1={center} x2={point(i, 100).split(',')[0]} y2={point(i, 100).split(',')[1]} /><text className="radar-label" x={point(i, 116).split(',')[0]} y={point(i, 116).split(',')[1]}>{label}</text></g>)}
    {players.map((player, p) => <polygon key={player.playerId} points={radarMetrics.map(([key], i) => point(i, player.normalized[key] ?? 0)).join(' ')} fill={colors[p]} stroke={colors[p]} className="radar-player" />)}
  </svg><div className="comparison-legend">{players.map((p, i) => <span key={p.playerId}><i style={{ background: colors[i] }} />{p.name}</span>)}</div></div>;
}

export function PlayerComparison() {
  const { players, playersError, openPlayerDetail } = useAppContext();
  const positions = useMemo(() => Array.from(new Set(players.map(p => getPositionGroup(p.position)).filter(Boolean))).sort(), [players]);
  const [position, setPosition] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [windowSize, setWindowSize] = useState(10);
  const [customDates, setCustomDates] = useState(false);
  const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState('');
  const [result, setResult] = useState<Response | null>(null); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const candidates = players.filter(p => getPositionGroup(p.position) === position);

  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(x => x !== id) : current.length < 4 ? [...current, id] : current);
  async function compare() {
    setLoading(true); setError(null); setResult(null);
    try {
      const response = await fetch('/api/analytics/players/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerIds: selected, position, window: windowSize, dateFrom: customDates ? dateFrom : undefined, dateTo: customDates ? dateTo : undefined }) });
      const payload = await response.json() as Response;
      if (!response.ok) throw new Error(payload.message ?? 'Không thể tải dữ liệu so sánh.');
      setResult(payload);
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể tải dữ liệu so sánh.'); }
    finally { setLoading(false); }
  }

  return <div className="tracker-shell comparison-page">
    <section className="hero-card"><div><p className="eyebrow">Decision support</p><h2>So sánh cầu thủ</h2><p className="hero-copy">Đối chiếu 2–4 cầu thủ cùng nhóm vị trí bằng một thang đo thống nhất.</p></div><div className="hero-metrics"><span className="metric-label">Đã chọn</span><strong>{selected.length}/4 cầu thủ</strong></div></section>
    <section className="panel comparison-controls"><label className="field"><span>1. Chọn nhóm vị trí</span><select value={position} onChange={e => { setPosition(e.target.value); setSelected([]); setResult(null); }}><option value="">Chọn vị trí</option>{positions.map(p => <option key={p} value={p}>{p}</option>)}</select></label>
      <div><span className="control-label">2. Chọn cầu thủ (2–4)</span><div className="comparison-picker">{!position ? <p className="analysis-empty">Chọn vị trí trước để xem cầu thủ.</p> : candidates.length ? candidates.map(p => <button type="button" key={p.playerId} className={selected.includes(p.playerId) ? 'selected' : ''} onClick={() => toggle(p.playerId)} disabled={!selected.includes(p.playerId) && selected.length >= 4}>{p.name}<small>{p.position} · {p.cardSeason}</small></button>) : <p className="analysis-empty">Không có cầu thủ ở vị trí này.</p>}</div></div>
      <div className="comparison-window"><label className="field"><span>3. Khoảng phân tích</span><select value={windowSize} onChange={e => setWindowSize(Number(e.target.value))} disabled={customDates}><option value={5}>5 trận gần nhất</option><option value={10}>10 trận gần nhất</option><option value={20}>20 trận gần nhất</option></select></label><label className="checkbox-row"><input type="checkbox" checked={customDates} onChange={e => setCustomDates(e.target.checked)} />Khoảng ngày tùy chọn</label>{customDates && <><label className="field"><span>Từ ngày</span><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></label><label className="field"><span>Đến ngày</span><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></label></>}</div>
      <button className="primary-button" disabled={selected.length < 2 || loading} onClick={compare}>{loading ? 'Đang phân tích…' : 'So sánh ngay'}</button>{playersError && <p className="inline-message error">{playersError}</p>}{error && <p className="inline-message error">{error}</p>}
    </section>
    {result && <><section className="panel"><div className="panel-header"><div><p className="panel-kicker">Radar chuẩn hóa 0–100</p><h2>Tổng quan phong độ</h2></div></div>{result.players.some(p => p.matchCount > 0) ? <Radar players={result.players} /> : <p className="analysis-empty">Chưa có dữ liệu trong khoảng đã chọn.</p>}{result.imbalanceWarning && <p className="comparison-warning">{result.imbalanceWarning}</p>}</section>
      <section className="panel"><div className="panel-header"><div><p className="panel-kicker">Chi tiết</p><h2>Bảng so sánh</h2></div></div><div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>Metric</th>{result.players.map(p => <th key={p.playerId}>{p.name}<small>{p.matchCount} trận</small><button onClick={() => openPlayerDetail(p.playerId)}>Mở chi tiết</button></th>)}</tr></thead><tbody>{tableMetrics.map(([key, label, higher]) => { const values = result.players.map(p => p.metrics[key] ?? 0); const best = higher ? Math.max(...values) : Math.min(...values); return <tr key={key}><th>{label}</th>{result.players.map((p, i) => <td key={p.playerId} className={values[i] === best && p.matchCount ? 'best' : ''}>{values[i].toFixed(2)}</td>)}</tr>; })}</tbody></table></div><div className="comparison-notes">{result.players.map(p => p.warning && <p key={p.playerId}><strong>{p.name}:</strong> {p.warning} ({p.matchCount} trận).</p>)}</div></section></>}
  </div>;
}
