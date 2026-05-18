"use client";

import React from 'react';
import type { RiskLevel, TrendStatus } from '../lib/types';
import { DETAILED_POSITIONS_BY_GROUP, getPositionColor } from '../lib/positions';

interface PerformancePlayer {
  name: string;
  cardSeason: string;
  position: string;
  matchCount?: number | null;
  wmaScore?: number | null;
  trendStatus?: TrendStatus | null;
  riskLevel?: RiskLevel | null;
}

interface PerformanceTableProps {
  players: PerformancePlayer[];
  title?: string;
  loading?: boolean;
  error?: string | null;
}

type SortKey = 'position' | 'matches' | 'wma' | 'trend' | 'risk' | 'name';
type SortDir = 'asc' | 'desc';

function getPositionGroup(position: string): string {
  if (!position) return 'gray';
  const normalized = position.trim().toUpperCase();

  for (const [group, positions] of Object.entries(DETAILED_POSITIONS_BY_GROUP)) {
    if ((positions as string[]).includes(normalized)) {
      return group;
    }
  }

  return 'gray';
}

function getPositionGroupColor(position: string): string {
  const group = getPositionGroup(position);
  return getPositionColor(group as any);
}

function getTrendLabel(trend?: TrendStatus): string {
  if (!trend) return '—';
  if (trend === 'UP') return '↑ Tăng';
  if (trend === 'DOWN') return '↓ Giảm';
  return '→ Ổn định';
}

function getTrendColor(trend?: TrendStatus): string {
  if (!trend) return 'text-gray-500';
  if (trend === 'UP') return 'text-green-600';
  if (trend === 'DOWN') return 'text-red-600';
  return 'text-blue-600';
}

function getRiskLevelLabel(risk?: RiskLevel): string {
  if (!risk) return '—';
  if (risk === 'LOW') return 'Thấp';
  if (risk === 'MEDIUM') return 'Trung bình';
  if (risk === 'HIGH') return 'Cao';
  return '—';
}

function getRiskLevelColor(risk?: RiskLevel): string {
  if (!risk) return 'text-gray-500';
  if (risk === 'LOW') return 'text-green-600';
  if (risk === 'MEDIUM') return 'text-yellow-600';
  if (risk === 'HIGH') return 'text-red-600';
  return 'text-gray-500';
}

function getRiskBgClass(risk?: RiskLevel | null): string {
  const textClass = getRiskLevelColor(risk ?? undefined);
  if (!textClass || !textClass.startsWith('text-')) return 'bg-gray-50';
  // derive bg from text class, e.g. text-green-600 -> bg-green-50
  try {
    return textClass.replace(/^text-/, 'bg-').replace(/-600|-500|-700/, '-50');
  } catch (err) {
    return 'bg-gray-50';
  }
}

function getRiskStyles(risk?: RiskLevel | null) {
  // central helper returning both text class and bg class for risk
  const text = getRiskLevelColor(risk ?? undefined);
  let bg = 'bg-gray-50';
  if (risk === 'LOW') bg = 'bg-green-50';
  else if (risk === 'MEDIUM') bg = 'bg-yellow-50';
  else if (risk === 'HIGH') bg = 'bg-red-50';
  return { text, bg } as const;
}

function getRiskRowBgClass(risk?: RiskLevel | null): string {
  // row background class - slightly lighter than badge colors
  if (risk === 'LOW') return 'bg-green-50/80';
  if (risk === 'MEDIUM') return 'bg-yellow-50/80';
  if (risk === 'HIGH') return 'bg-red-50/80';
  // make default rows visibly shaded (zebra-like feel when combined with table)
  return 'bg-gray-50';
}

function getRiskRowHoverClass(risk?: RiskLevel | null): string {
  // subtle hover effect that preserves risk color
  if (risk === 'LOW') return 'hover:bg-green-100/60';
  if (risk === 'MEDIUM') return 'hover:bg-yellow-100/60';
  if (risk === 'HIGH') return 'hover:bg-red-100/60';
  return 'hover:bg-gray-100/50';
}

function getPositionBgColor(position: string): string {
  const color = getPositionGroupColor(position);
  const colorClasses: Record<string, string> = {
    yellow: 'bg-yellow-50',
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    orange: 'bg-orange-50',
    gray: 'bg-gray-50'
  };
  return colorClasses[color] || colorClasses['gray'];
}

export function PerformanceTable({ players, title, loading = false, error = null }: PerformanceTableProps) {
  const [query, setQuery] = React.useState('');
  const [sortKey, setSortKey] = React.useState<SortKey>('wma');
  const [sortDir, setSortDir] = React.useState<SortDir>('desc');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = Array.isArray(players) ? players.slice() : [];
    if (q) {
      list = list.filter((p) => (p.name ?? '').toLowerCase().includes(q) || (p.cardSeason ?? '').toLowerCase().includes(q) || (p.position ?? '').toLowerCase().includes(q));
    }

    const compareNumber = (an?: number | null, bn?: number | null) => {
      const aU = an == null;
      const bU = bn == null;
      if (aU && bU) return 0;
      if (aU) return 1; // missing goes to end
      if (bU) return -1;
      return an! - bn!;
    };

    const trendRank = (t?: TrendStatus | null) => {
      if (!t) return 99;
      if (t === 'UP') return 0;
      if (t === 'STABLE') return 1;
      if (t === 'DOWN') return 2;
      return 99;
    };

    const riskRank = (r?: RiskLevel | null) => {
      if (!r) return 99;
      if (r === 'HIGH') return 0;
      if (r === 'MEDIUM') return 1;
      if (r === 'LOW') return 2;
      return 99;
    };

    const positionGroupOrder = ['GK', 'DF', 'MF', 'FW'];

    const getGroupIndex = (pos?: string) => {
      try {
        const g = getPositionGroup(pos ?? '');
        const idx = positionGroupOrder.indexOf(String(g).toUpperCase());
        return idx === -1 ? 99 : idx;
      } catch (err) {
        return 99;
      }
    };

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'wma': {
          cmp = compareNumber(a.wmaScore, b.wmaScore);
          break;
        }
        case 'matches': {
          cmp = compareNumber(a.matchCount ?? null, b.matchCount ?? null);
          break;
        }
        case 'trend': {
          cmp = trendRank(a.trendStatus) - trendRank(b.trendStatus);
          break;
        }
        case 'risk': {
          cmp = riskRank(a.riskLevel) - riskRank(b.riskLevel);
          break;
        }
        case 'position': {
          const ga = getGroupIndex(a.position);
          const gb = getGroupIndex(b.position);
          if (ga !== gb) cmp = ga - gb;
          else cmp = (a.position || '').localeCompare(b.position || '') || (a.name || '').localeCompare(b.name || '');
          break;
        }
        case 'name':
        default:
          cmp = (a.name || '').localeCompare(b.name || '');
      }

      // for numeric compareNumber we returned a-b (ascending). We want default sort to be desc when sortDir==='desc'
      if (sortDir === 'desc') return -cmp;
      return cmp;
    });

    return list;
  }, [players, query, sortKey, sortDir]);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{title || 'Phong độ cầu thủ'}</div>
        <div className="inline-message">Đang tải dữ liệu...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{title || 'Phong độ cầu thủ'}</div>
        <div className="inline-message error">{error}</div>
      </div>
    );
  }

  if (!filtered || filtered.length === 0) {
    return (
      <div className="p-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>{title || 'Phong độ cầu thủ'}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input aria-label="Tìm cầu thủ" placeholder="Tìm tên, mùa, vị trí" value={query} onChange={(e) => setQuery(e.target.value)} style={{ padding: '8px 12px', borderRadius: 12, border: '1px solid var(--border)' }} />
            <select value={sortKey} onChange={(e) => { setSortKey(e.target.value as SortKey); setSortDir('desc'); }} style={{ padding: '8px 12px', borderRadius: 12, border: '1px solid var(--border)' }}>
              <option value="wma">Sắp xếp: WMA</option>
              <option value="matches">Sắp xếp: Số trận</option>
              <option value="name">Sắp xếp: Tên</option>
            </select>
          </div>
        </div>
        <div className="inline-message">Chưa có dữ liệu để hiển thị</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700 }}>{title || 'Phong độ cầu thủ'}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input aria-label="Tìm cầu thủ" placeholder="Tìm tên, mùa, vị trí" value={query} onChange={(e) => setQuery(e.target.value)} style={{ padding: '8px 12px', borderRadius: 12, border: '1px solid var(--border)' }} />
          <select value={sortKey} onChange={(e) => { setSortKey(e.target.value as SortKey); setSortDir('desc'); }} style={{ padding: '8px 12px', borderRadius: 12, border: '1px solid var(--border)' }}>
            <option value="wma">Sắp xếp: WMA</option>
            <option value="matches">Sắp xếp: Số trận</option>
            <option value="name">Sắp xếp: Tên</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto" style={{ marginLeft: '-22px', marginRight: '-22px', paddingLeft: 0, paddingRight: 0 }}>
        <table className="w-full border-collapse" style={{ width: '100%', minWidth: 720, tableLayout: 'auto' }}>
          <thead>
            <tr className="border-b-2 border-gray-300" style={{ background: 'linear-gradient(135deg, rgba(15,125,82,0.72) 0%, rgba(10,90,61,0.54) 100%)' }}>
              <th className="px-4 py-3 text-left text-sm font-bold text-white">Tên cầu thủ</th>
              <th className="px-4 py-3 text-left text-sm font-bold text-white" style={{ minWidth: 96 }}>Mùa thẻ</th>
              <th
                className="px-4 py-3 text-left text-sm font-bold text-white cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => handleSort('position')}
                aria-sort={sortKey === 'position' ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
              >
                Vị trí <span style={{ opacity: sortKey === 'position' ? 1 : 0.36, marginLeft: '6px' }}>{sortKey === 'position' ? (sortDir === 'desc' ? '↓' : '↑') : '↓'}</span>
              </th>
              <th
                className="px-4 py-3 text-center text-sm font-bold text-white cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => handleSort('matches')}
                aria-sort={sortKey === 'matches' ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
              >
                Số trận <span style={{ opacity: sortKey === 'matches' ? 1 : 0.36, marginLeft: '6px' }}>{sortKey === 'matches' ? (sortDir === 'desc' ? '↓' : '↑') : '↓'}</span>
              </th>
              <th
                className="px-4 py-3 text-center text-sm font-bold text-white cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => handleSort('wma')}
                aria-sort={sortKey === 'wma' ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
              >
                WMA <span style={{ opacity: sortKey === 'wma' ? 1 : 0.36, marginLeft: '6px' }}>{sortKey === 'wma' ? (sortDir === 'desc' ? '↓' : '↑') : '↓'}</span>
              </th>
              <th
                className="px-4 py-3 text-center text-sm font-bold text-white cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => handleSort('trend')}
                aria-sort={sortKey === 'trend' ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
              >
                Xu hướng <span style={{ opacity: sortKey === 'trend' ? 1 : 0.36, marginLeft: '6px' }}>{sortKey === 'trend' ? (sortDir === 'desc' ? '↓' : '↑') : '↓'}</span>
              </th>
              <th
                className="px-4 py-3 text-center text-sm font-bold text-white cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => handleSort('risk')}
                aria-sort={sortKey === 'risk' ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
              >
                Risk <span style={{ opacity: sortKey === 'risk' ? 1 : 0.36, marginLeft: '6px' }}>{sortKey === 'risk' ? (sortDir === 'desc' ? '↓' : '↑') : '↓'}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((player, index) => {
              const riskRowBg = getRiskRowBgClass(player.riskLevel);
              const riskRowHover = getRiskRowHoverClass(player.riskLevel);
              const { text: riskTextClass } = getRiskStyles(player.riskLevel);
              const zebraBg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
              const rowBg = player.riskLevel ? riskRowBg : zebraBg;
              return (
                <tr
                  key={player.name + '|' + index}
                  className={`border-b border-gray-200 transition-colors ${rowBg} ${riskRowHover}`}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{player.name || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{player.cardSeason || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 4, display: 'inline-block', background: getPositionGroupColor(player.position) }} />
                      <span>{player.position || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-center text-gray-700">{player.matchCount != null ? player.matchCount : 'N/A'}</td>
                  <td className="px-4 py-3 text-sm text-center text-gray-700 font-medium">{player.wmaScore != null ? player.wmaScore.toFixed(1) : 'N/A'}</td>
                  <td className="px-4 py-3 text-sm text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getTrendColor(player.trendStatus ?? undefined)}`}>
                      {getTrendLabel(player.trendStatus ?? undefined)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${riskTextClass}`}>
                      {getRiskLevelLabel(player.riskLevel ?? undefined)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PerformanceTable;
