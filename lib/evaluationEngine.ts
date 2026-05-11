import type { PlayerAssessment, RecentMatch } from './types';

export function roundToOneDecimal(value: number): number {
  return Number(value.toFixed(1));
}

export function classifyAverageScore(averageScore: number): PlayerAssessment {
  if (averageScore > 8) {
    return {
      averageScore: roundToOneDecimal(averageScore),
      status: 'Star Player',
      action: 'Giữ chặt đội hình chính',
      color: 'green'
    };
  }

  if (averageScore >= 6) {
    return {
      averageScore: roundToOneDecimal(averageScore),
      status: 'Stable',
      action: 'Tiếp tục tin dùng',
      color: 'white'
    };
  }

  if (averageScore >= 4.5) {
    return {
      averageScore: roundToOneDecimal(averageScore),
      status: 'Under Review',
      action: 'Đẩy lên ghế dự bị',
      color: 'orange'
    };
  }

  return {
    averageScore: roundToOneDecimal(averageScore),
    status: 'Fraud',
    action: 'Thanh lý ngay lập tức',
    color: 'red'
  };
}

export function evaluateRecentMatches(matches: RecentMatch[]): PlayerAssessment {
  if (matches.length === 0) {
    return classifyAverageScore(0);
  }

  const averageScore =
    matches.reduce((sum, match) => sum + match.score, 0) / matches.length;

  return classifyAverageScore(averageScore);
}