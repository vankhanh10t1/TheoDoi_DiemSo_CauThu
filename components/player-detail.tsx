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
  const { selectedPlayerId, setSelectedPlayerId, setCurrentTab, refreshTrigger, triggerRefresh, resetPlayerData } =
    useAppContext();
  const [statusData, setStatusData] = useState<PlayerStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [formState, setFormState] = useState<EntryFormState>({
    playerId: selectedPlayerId || '',
    score: 7,
    isStarter: true,
    result: 'Win',
    positionGroup: 'GK',
    detailedPosition: 'GK'
  });
  const [saveState, setSaveState] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null
  );
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedPlayerId) {
      setSaveState({ message: 'Không có cầu thủ nào được chọn', type: 'error' });
      return;
    }

    const resolvedDetailedPosition =
      formState.positionGroup === 'GK' ? 'GK' : formState.detailedPosition;

    if (!isDetailedPositionForGroup(formState.positionGroup, resolvedDetailedPosition)) {
      setSaveState({
        message: 'Vị trí chi tiết không hợp lệ với nhóm vị trí đã chọn',
        type: 'error'
      });
      return;
    }

    setSaveState(null);

    try {
      const res = await fetch('/api/rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: selectedPlayerId,
          score: Number(formState.score),
          isStarter: formState.isStarter,
          result: formState.result,
          positionGroup: formState.positionGroup,
          detailedPosition: resolvedDetailedPosition
        })
      });

      const payload = (await res.json()) as { message?: string; sk?: string };

      if (!res.ok) {
        throw new Error(payload.message ?? 'Không thể lưu điểm');
      }

      setSaveState({
        message: `Đã lưu thành công ${payload.sk ?? ''}`.trim(),
        type: 'success'
      });
      triggerRefresh();
    } catch (err) {
      setSaveState({
        message: err instanceof Error ? err.message : 'Không thể lưu điểm',
        type: 'error'
      });
    }
  }

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
  const isDetailedPositionRequired = formState.positionGroup !== 'GK';

  return (
    <div className="screen-panel">
      <div className="screen-header">
        <button className="back-button" onClick={() => setSelectedPlayerId(null)}>
          ← Quay Lại
        </button>
        <h2>Chi Tiết Cầu Thủ</h2>
      </div>

      {!selectedPlayerId ? (
        <p>Vui lòng chọn cầu thủ để xem chi tiết.</p>
      ) : (
        <div className="detail-grid">
          <div className="detail-panel">
            <h3>Nhập Điểm Trận</h3>
            <form className="form-stack" onSubmit={handleSubmit}>
              <div className="field-grid">
                <label className="field">
                  <span>Điểm Trận (1-10)</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="0.1"
                    value={formState.score}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        score: e.target.value === '' ? 0 : Number(e.target.value)
                      }))
                    }
                  />
                </label>

                <label className="field">
                  <span>Kết Quả</span>
                  <select
                    value={formState.result}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        result: e.target.value as RatingPayload['result']
                      }))
                    }
                  >
                    <option value="Win">Thắng</option>
                    <option value="Draw">Hòa</option>
                    <option value="Loss">Thua</option>
                  </select>
                </label>
              </div>

              <div className="field-grid">
                <label className="field">
                  <span>Position Group</span>
                  <select
                    value={formState.positionGroup}
                    onChange={(e) => {
                      const nextGroup = e.target.value as RatingPayload['positionGroup'];

                      setFormState((prev) => ({
                        ...prev,
                        positionGroup: nextGroup,
                        detailedPosition: nextGroup === 'GK' ? 'GK' : ''
                      }));
                    }}
                  >
                    {POSITION_GROUPS.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </label>

                {isDetailedPositionRequired ? (
                  <label className="field">
                    <span>Detailed Position</span>
                    <select
                      value={formState.detailedPosition}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          detailedPosition: e.target.value as RatingPayload['detailedPosition']
                        }))
                      }
                    >
                      <option value="">Chọn vị trí chi tiết</option>
                      {getDetailedPositionsByGroup(formState.positionGroup).map((position) => (
                        <option key={position} value={position}>
                          {position}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={formState.isStarter}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, isStarter: e.target.checked }))
                  }
                />
                <span>Đá Chính</span>
              </label>

              <button className="primary-button" type="submit">
                Lưu Điểm
              </button>

              {saveState && (
                <p className={`inline-message ${saveState.type}`}>{saveState.message}</p>
              )}
            </form>
          </div>

          <div className="detail-panel">
            <h3>Phong Độ Hiện Tại</h3>

            {loadingStatus && <p>Đang tải...</p>}
            {statusError && <p className="status-error">{statusError}</p>}

            {resetState && (
              <p className={`inline-message ${resetState.type}`}>{resetState.message}</p>
            )}

            {statusData && (
              <div className={`status-card ${statusTone}`}>
                <div className="status-topline">
                  <strong>{statusData.name}</strong>
                  <span>{statusData.status}</span>
                </div>

                {!statusError && 'averageScore' in statusData ? (
                  <>
                    <div className="score-badge">{statusData.averageScore.toFixed(1)}</div>
                    <div className="status-grid">
                      <div>
                        <span className="metric-label">Số Trận</span>
                        <strong>{statusData.matchCount}</strong>
                      </div>
                      <div>
                        <span className="metric-label">Hành Động</span>
                        <strong>{statusData.action}</strong>
                      </div>
                    </div>

                    {statusData.recentMatches.length > 0 && (
                      <>
                        <h4 style={{ marginTop: '16px', marginBottom: '8px' }}>5 Trận Gần Nhất</h4>
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
                      </>
                    )}

                    <button 
                      className="secondary-button" 
                      onClick={handleResetData}
                      style={{ marginTop: '16px', width: '100%' }}
                    >
                      🔄 Reset Lịch Sử
                    </button>
                  </>
                ) : null}

                {!statusError && 'message' in statusData ? (
                  <div className="tracking-state">
                    <p>{statusData.message}</p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
