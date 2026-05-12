'use client';

import { useEffect, useState } from 'react';
import {
  getDetailedPositionsByGroup,
  isDetailedPositionForGroup,
  POSITION_GROUPS
} from '../lib/positions';
import type { PlayerStatusResponse, RatingPayload } from '../lib/types';
import { useAppContext } from './app-context';

type EntryFormState = Omit<RatingPayload, 'detailedPosition'> & {
  detailedPosition: RatingPayload['detailedPosition'] | '';
};

export function PlayerDetail() {
  const { selectedPlayerId, closePlayerDetail, refreshTrigger, resetPlayerData } = useAppContext();
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
        const res = await fetch(
          `/api/player-status?id=${encodeURIComponent(selectedPlayerId || '')}`
        );
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
                  <div className="score-badge">{('averageScore' in statusData ? statusData.averageScore.toFixed(1) : 'N/A')}</div>
                </div>
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
                <h4 style={{ marginTop: '8px' }}>5 Trận Gần Nhất</h4>
                <div className="recent-list">
                  {statusData.recentMatches.map((match) => (
                    <div key={match.sk} className="recent-item">
                      <span>{match.sk}</span>
                      <strong>{match.score.toFixed(1)}</strong>
                      <em>{match.result}</em>
                      <small>
                        {match.positionGroup && match.detailedPosition
                          ? `${match.positionGroup} - ${match.detailedPosition}`
                          : 'N/A'}
                      </small>
                    </div>
                  ))}
                </div>
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
