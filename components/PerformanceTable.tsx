"use client";

import React from 'react';
import type { RiskLevel, TrendStatus } from '../lib/types';
import { DETAILED_POSITIONS_BY_GROUP, getPositionColor } from '../lib/positions';

interface PerformancePlayer {
  name: string;
  cardSeason: string;
  position: string;
  matchCount?: number;
  wmaScore?: number;
  trendStatus?: TrendStatus;
  riskLevel?: RiskLevel;
}

interface PerformanceTableProps {
  players: PerformancePlayer[];
  title?: string;
}

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

export function PerformanceTable({ players, title }: PerformanceTableProps) {
  if (!players || players.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        {title || 'Phong độ cầu thủ'} - Không có dữ liệu
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-300 bg-gray-50">
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tên cầu thủ</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Mùa thẻ</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Vị trí</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Số trận</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">WMA</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Xu hướng</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Risk</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => (
            <tr
              key={index}
              className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${getPositionBgColor(player.position)}`}>
              <td className="px-4 py-3 text-sm font-medium text-gray-900">{player.name}</td>
              <td className="px-4 py-3 text-sm text-gray-700">{player.cardSeason}</td>
              <td className="px-4 py-3 text-sm font-medium text-gray-800">{player.position}</td>
              <td className="px-4 py-3 text-sm text-center text-gray-700">{player.matchCount !== undefined ? player.matchCount : '—'}</td>
              <td className="px-4 py-3 text-sm text-center text-gray-700 font-medium">{player.wmaScore !== undefined ? player.wmaScore.toFixed(1) : '—'}</td>
              <td className={`px-4 py-3 text-sm text-center font-medium ${getTrendColor(player.trendStatus)}`}>{getTrendLabel(player.trendStatus)}</td>
              <td className={`px-4 py-3 text-sm text-center font-medium ${getRiskLevelColor(player.riskLevel)}`}>{getRiskLevelLabel(player.riskLevel)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PerformanceTable;
