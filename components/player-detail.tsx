'use client';

import { useEffect, useState } from 'react';
import type { PlayerStatusResponse, RatingPayload } from '../lib/types';
import { useAppContext } from './app-context';
import { fetchWithDebug } from '../lib/client-api';
import { getMatchSortTimestamp, sortRecentMatchesNewestFirst } from '../lib/match-history';

function formatRatingDate(match: { matchDateTime?: string; matchDate?: string; matchTime?: string; createdAt?: string }): string {
  const timestamp = getMatchSortTimestamp(match);
  return timestamp
    ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(timestamp))
    : 'Không rõ thời gian';
}

function getTrendLabel(status?: string): string {
  if (status === 'UP') return 'Tăng';
  if (status === 'DOWN') return 'Giảm';
  return 'Ổn định';
}

function getStabilityLabel(status?: string): string {
  if (status === 'VOLATILE') return 'Biến động';
  if (status === 'UNSTABLE') return 'Chưa ổn định';
  return 'Ổn định';
}

function getMomentumLabel(status?: string): string {
  if (status === 'HOT') return 'Nóng';
  if (status === 'COLD') return 'Lạnh';
  return 'Bình thường';
}

function getRecommendationLabel(value?: string): string {
  if (value === 'KEEP') return 'GIỮ';
  if (value === 'MONITOR') return 'THEO DÕI';
  if (value === 'BENCH') return 'DỰ BỊ';
  if (value === 'SELL') return 'BÁN';
  if (value === 'REPLACE') return 'THAY THẾ';
  return '—';
}

type EntryFormState = Omit<RatingPayload, 'detailedPosition'> & {
  detailedPosition: RatingPayload['detailedPosition'] | '';
};

export function PlayerDetail() {
  const { selectedPlayerId, closePlayerDetail, refreshTrigger, resetPlayerData, triggerRefresh } = useAppContext();
  const [statusData, setStatusData] = useState<PlayerStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [resetState, setResetState] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null
  );

  useEffect(() => {
    if (!selectedPlayerId) {
      setStatusData(null);
      setStatusError(null);
      return;
    }

    async function loadStatus() {
      setLoadingStatus(true);
      setStatusError(null);

      try {
        const res = await fetchWithDebug(
          `/api/player-status?id=${encodeURIComponent(selectedPlayerId || '')}`
        , undefined, { caller: 'PlayerDetail.loadStatus' });
        const errorPayload = (await res.json()) as { message?: string };

        if (!res.ok) {
          throw new Error(errorPayload.message ?? 'Không thể tải phong độ');
        }

        setStatusData(errorPayload as PlayerStatusResponse);
      } catch (err) {
        setStatusData(null);
        setStatusError(err instanceof Error ? err.message : 'Không thể tải phong độ');
      } finally {
        setLoadingStatus(false);
      }
    }

    loadStatus();
  }, [selectedPlayerId, refreshTrigger]);

  async function handleResetData() {
    if (!selectedPlayerId) {
      setResetState({ message: 'Không có cầu thủ nào được chọn', type: 'error' });
      return;
    }

    const confirmed = window.confirm(
      'Bạn có chắc chắn muốn reset toàn bộ lịch sử trận đấu của cầu thủ này không? Hành động này không thể hoàn tác.'
    );
    if (!confirmed) return;

    setResetState(null);

    try {
      const result = await resetPlayerData(selectedPlayerId);
      if (!result.ok) throw new Error(result.message ?? 'Failed');

      setResetState({
        message: 'Đã reset lịch sử trận đấu thành công',
        type: 'success'
      });
      triggerRefresh();
    } catch (err) {
      setResetState({
        message: err instanceof Error ? err.message : 'Không thể reset lịch sử',
        type: 'error'
      });
    }
  }

  const statusTone = statusData && 'color' in statusData ? statusData.color : 'neutral';

  return (
    <div className="screen-panel">
      <div className="screen-header">
        <button className="back-button" onClick={() => closePlayerDetail()}>
          ← Quay Lại
        </button>
        <h2>Chi Tiết Cầu Thủ</h2>
      </div>

      {!selectedPlayerId ? (
        <p>Vui lòng chọn cầu thủ để xem chi tiết.</p>
      ) : (
        <div className="detail-grid">
          <div className="detail-panel">
            <h3>Thông Tin Cầu Thủ</h3>
            {statusData ? (
              <div>
                <strong>{statusData.name}</strong>
                <div style={{ marginTop: 8 }}>
                  {('matchCount' in statusData && statusData.matchCount < 3) ? (
                    <div className="score-badge" style={{ textAlign: 'center', color: '#999' }}>
                      Not enough data ({statusData.matchCount} match{statusData.matchCount !== 1 ? 'es' : ''})
                    </div>
                  ) : ('wmaScore' in statusData) ? (
                    <div className="score-badge">
                      <div>Average: {statusData.averageScore.toFixed(1)}</div>
                      <div style={{ marginTop: '4px' }}>WMA: {statusData.wmaScore.toFixed(1)}</div>
                      <div style={{ marginTop: '4px' }}>Trend: {getTrendLabel(statusData.trendStatus)}</div>
                    </div>
                  ) : (
                    <div className="score-badge">WMA N/A</div>
                  )}
                </div>
                {'wmaScore' in statusData ? (
                  <>
                    <div className="status-grid" style={{ marginTop: 12 }}>
                      <div><span className="metric-label">Trend</span><strong>{getTrendLabel(statusData.trendStatus)}</strong></div>
                      <div><span className="metric-label">Variance</span><strong>{statusData.variance.toFixed(2)}</strong></div>
                      <div><span className="metric-label">Stability</span><strong>{getStabilityLabel(statusData.stabilityLevel)}</strong></div>
                      <div><span className="metric-label">Momentum</span><strong>{getMomentumLabel(statusData.momentumStatus)}</strong></div>
                      <div><span className="metric-label">Predicted</span><strong>{statusData.predictedScore.toFixed(1)}</strong></div>
                      <div><span className="metric-label">Risk</span><strong>{statusData.riskLevel} ({statusData.riskScore.toFixed(1)})</strong></div>
                      <div><span className="metric-label">Confidence</span><strong>{Math.round(statusData.confidence * 100)}%</strong></div>
                      <div><span className="metric-label">Recommend</span><strong>{getRecommendationLabel(statusData.recommendation)}</strong></div>
                    </div>

                    {'adjustedAverageScore' in statusData ? (
                      <div className="status-grid" style={{ marginTop: 12 }}>
                        <div><span className="metric-label">Average</span><strong>{statusData.averageScore.toFixed(1)}</strong></div>
                        <div><span className="metric-label">Adjusted Avg</span><strong>{statusData.adjustedAverageScore.toFixed(1)}</strong></div>
                        <div><span className="metric-label">Match Impact</span><strong>{statusData.matchImpactAvg.toFixed(2)}</strong></div>
                        <div><span className="metric-label">Big Wins</span><strong>{statusData.bigWinCountLast5} ({(statusData.bigWinRate * 100).toFixed(0)}%)</strong></div>
                        <div><span className="metric-label">Big Losses</span><strong>{statusData.bigLossCountLast5} ({(statusData.bigLossRate * 100).toFixed(0)}%)</strong></div>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : loadingStatus ? (
              <p>Đang tải...</p>
            ) : statusError ? (
              <p className="status-error">{statusError}</p>
            ) : (
              <p>Không có dữ liệu cầu thủ.</p>
            )}
          </div>

          <div className="detail-panel">
            <h3>Phong Độ & Lịch Sử</h3>

            {statusData && 'recentMatches' in statusData && statusData.recentMatches.length > 0 ? (
              <div>
                <h4 style={{ marginTop: '8px' }}>Lịch sử điểm đánh giá ({statusData.recentMatches.length} trận)</h4>
                <div className="recent-list">
                  {sortRecentMatchesNewestFirst(statusData.recentMatches).map((match) => (
                    <div key={match.sk} className="recent-item">
                      <span>{formatRatingDate(match)}</span>
                      <strong>{match.score.toFixed(1)}</strong>
                      <em>{match.result}</em>
                      <small>
                        {match.positionGroup && match.detailedPosition
                          ? `${match.positionGroup} - ${match.detailedPosition}`
                          : 'N/A'}
                        <span style={{ marginLeft: 8 }}>
                          🟨{(match as any).yellowCards ?? 0} 
                          🟥{(match as any).redCards ?? 0} 
                          ⚠️{(match as any).fouls ?? 0}
                        </span>
                        {(match.goals ?? 0) > 0 || (match.assists ?? 0) > 0
                          ? ` · Bàn ${match.goals ?? 0} · Kiến tạo ${match.assists ?? 0}`
                          : ''}
                        {match.note ? ` · ${match.note}` : ''}
                      </small>
                    </div>
                  ))}
                </div>
                {'fraudRisk' in statusData && statusData.fraudRisk ? (
                  <p className="inline-message error" style={{ marginTop: '12px' }}>
                    Fraud alert: {statusData.fraudReasons.join(', ')}
                  </p>
                ) : null}
              </div>
            ) : null}

            {resetState && (
              <p className={`inline-message ${resetState.type}`}>{resetState.message}</p>
            )}

            <button
              className="secondary-button"
              onClick={handleResetData}
              style={{ marginTop: '16px', width: '100%' }}
            >
              🔄 Reset Lịch Sử
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
