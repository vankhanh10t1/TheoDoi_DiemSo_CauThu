'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAppContext } from './app-context';
import { FormExtremesCard } from './form-extremes';
import {
  filterPlayersByPosition,
  getDetailedPositionsByGroup,
  isDetailedPositionForGroup,
  normalizeDetailedPosition,
  POSITION_GROUPS
} from '../lib/positions';
import type { PlayerStatusResponse, RatingPayload } from '../lib/types';

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

function getConfidenceLabel(value: number | undefined): string {
  if (typeof value !== 'number') return '—';
  if (value > 0.8) return 'HIGH';
  if (value >= 0.5) return 'MEDIUM';
  return 'LOW';
}

function getRecommendationLabel(value?: string): string {
  if (value === 'KEEP') return 'GIỮ';
  if (value === 'MONITOR') return 'THEO DÕI';
  if (value === 'BENCH') return 'DỰ BỊ';
  if (value === 'SELL') return 'BÁN';
  if (value === 'REPLACE') return 'THAY THẾ';
  return '—';
}


type SaveState = {
  message: string;
  tone: 'idle' | 'success' | 'error';
};

type EntryFormState = Omit<RatingPayload, 'detailedPosition'> & {
  detailedPosition: RatingPayload['detailedPosition'] | '';
};

const INITIAL_FORM: EntryFormState = {
  playerId: '',
  score: 7,
  isStarter: true,
  result: 'Win',
  positionGroup: 'GK',
  detailedPosition: 'GK'
};

function formatStatusTitle(status: PlayerStatusResponse['status'] | undefined): string {
  if (!status) {
    return 'Chưa có dữ liệu';
  }

  return status;
}

export function TrackerApp() {
  const { players, playersError } = useAppContext();
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [statusData, setStatusData] = useState<PlayerStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [formState, setFormState] = useState<EntryFormState>({
    ...INITIAL_FORM,
    playerId: players[0]?.playerId ?? ''
  });
  const [saveState, setSaveState] = useState<SaveState>({ message: '', tone: 'idle' });

  const selectedPlayer = useMemo(
    () => players.find((player) => player.playerId === selectedPlayerId) ?? null,
    [players, selectedPlayerId]
  );
  const isDetailedPositionRequired = formState.positionGroup !== 'GK';
  const detailedPositionOptions = useMemo(
    () => getDetailedPositionsByGroup(formState.positionGroup),
    [formState.positionGroup]
  );
  const selectedDetailedPosition = useMemo(() => {
    if (formState.positionGroup === 'GK') {
      return 'GK';
    }

    return isDetailedPositionForGroup(formState.positionGroup, formState.detailedPosition)
      ? formState.detailedPosition
      : undefined;
  }, [formState.detailedPosition, formState.positionGroup]);
  const filteredPlayers = useMemo(() => {
    return filterPlayersByPosition(
      players,
      formState.positionGroup,
      selectedDetailedPosition
    );
  }, [formState.positionGroup, players, selectedDetailedPosition]);

  useEffect(() => {
    setFormState((currentState) => ({ ...currentState, playerId: selectedPlayerId }));
  }, [selectedPlayerId]);

  useEffect(() => {
    if (!filteredPlayers.some((player) => player.playerId === selectedPlayerId)) {
      const nextPlayerId = filteredPlayers[0]?.playerId ?? '';
      setSelectedPlayerId(nextPlayerId);
      setFormState((currentState) => ({
        ...currentState,
        playerId: nextPlayerId
      }));
    }
  }, [filteredPlayers, selectedPlayerId]);

  useEffect(() => {
    if (!selectedPlayerId) {
      setStatusData(null);
      setStatusError(null);
      return;
    }

    const controller = new AbortController();

    async function loadStatus() {
      setLoadingStatus(true);
      setStatusError(null);

      try {
        const response = await fetch(`/api/player-status?id=${encodeURIComponent(selectedPlayerId)}`, {
          signal: controller.signal
        });

        const errorPayload = (await response.json()) as { message?: string };

        if (!response.ok) {
          throw new Error(errorPayload.message ?? 'Không thể tải phong độ cầu thủ');
        }

        const payload = errorPayload as PlayerStatusResponse;

        setStatusData(payload);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        setStatusData(null);
        setStatusError(error instanceof Error ? error.message : 'Không thể tải phong độ cầu thủ');
      } finally {
        setLoadingStatus(false);
      }
    }

    void loadStatus();

    return () => {
      controller.abort();
    };
  }, [selectedPlayerId]);

  async function refreshPlayerStatus(playerId: string) {
    try {
      const response = await fetch(`/api/player-status?id=${encodeURIComponent(playerId)}`);
      const errorPayload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(errorPayload.message ?? 'Không thể làm mới dữ liệu');
      }

      setStatusData(errorPayload as PlayerStatusResponse);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Không thể làm mới dữ liệu');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formState.playerId) {
      setSaveState({ message: 'Hãy chọn cầu thủ trước khi lưu', tone: 'error' });
      return;
    }

    const resolvedDetailedPosition = (() => {
      if (formState.positionGroup === 'GK') {
        return 'GK';
      }

      if (selectedDetailedPosition) {
        return selectedDetailedPosition;
      }

      return normalizeDetailedPosition(selectedPlayer?.position);
    })();

    if (!resolvedDetailedPosition || !isDetailedPositionForGroup(formState.positionGroup, resolvedDetailedPosition)) {
      setSaveState({
        message: 'Cầu thủ không thuộc nhóm vị trí đã chọn',
        tone: 'error'
      });
      return;
    }

    if (!filteredPlayers.some((player) => player.playerId === formState.playerId)) {
      setSaveState({
        message: 'Cầu thủ không thuộc vị trí đã chọn',
        tone: 'error'
      });
      return;
    }

    setSaveState({ message: '', tone: 'idle' });

    try {
      const response = await fetch('/api/rating', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          playerId: formState.playerId,
          score: Number(formState.score),
          isStarter: formState.isStarter,
          result: formState.result,
          positionGroup: formState.positionGroup,
          detailedPosition: resolvedDetailedPosition
        })
      });

      const payload = (await response.json()) as { message?: string; sk?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? 'Không thể lưu điểm trận đấu');
      }

      setSaveState({
        message: `Đã lưu thành công ${payload.sk ?? ''}`.trim(),
        tone: 'success'
      });
      await refreshPlayerStatus(formState.playerId);
    } catch (error) {
      setSaveState({
        message: error instanceof Error ? error.message : 'Không thể lưu điểm trận đấu',
        tone: 'error'
      });
    }
  }

  const statusTone =
    statusData && 'color' in statusData ? statusData.color : 'neutral';

  return (
    <div className="tracker-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">FCON Performance Tracker</p>
          <h2>Theo dõi phong độ của các cầu thủ thuộc đội bóng VanKhasnh14 trong 5 trận gần nhất</h2>
          <p className="hero-copy">
            Bán độ không bao giờ có chỗ đứng trong môn thể thao vua.
          </p>
        </div>
        <div className="hero-metrics">
          <div>
            <span className="metric-label">Cầu thủ</span>
            <strong>{players.length}</strong>
          </div>
          <div>
            <span className="metric-label">Team Color</span>
            <strong>Bayern Munich</strong>
          </div>
        </div>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Entry Flow</p>
              <h2>Nhập điểm trận đấu</h2>
            </div>
          </div>

          <div className="field-grid">
              <label className="field">
                <span>Position Group</span>
                <select
                  value={formState.positionGroup}
                  onChange={(event) => {
                    const nextGroup = event.target.value as RatingPayload['positionGroup'];

                    setFormState((currentState) => ({
                      ...currentState,
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
                    onChange={(event) => {
                      setFormState((currentState) => ({
                        ...currentState,
                        detailedPosition: event.target.value as RatingPayload['detailedPosition']
                      }));
                    }}
                  >
                    <option value="">Chọn vị trí chi tiết</option>
                    {detailedPositionOptions.map((position) => (
                      <option key={position} value={position}>
                        {position}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

          <form className="form-stack" onSubmit={handleSubmit}>
            <label className="field">
              <span>Cầu thủ</span>
              <select
                value={selectedPlayerId}
                onChange={(event) => {
                  setSelectedPlayerId(event.target.value);
                  setFormState((currentState) => ({
                    ...currentState,
                    playerId: event.target.value
                  }));
                }}
              >
                {filteredPlayers.map((player) => (
                  <option key={player.playerId} value={player.playerId}>
                    {player.name} · {player.cardSeason} · {player.position}
                  </option>
                ))}
              </select>
            </label>

            <div className="field-grid">
              <label className="field">
                <span>Điểm trận</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="0.1"
                  value={formState.score}
                  onChange={(event) => {
                    setFormState((currentState) => ({
                      ...currentState,
                      score: event.target.value === '' ? 0 : Number(event.target.value)
                    }));
                  }}
                />
              </label>

              <label className="field">
                <span>Kết quả</span>
                <select
                  value={formState.result}
                  onChange={(event) => {
                    setFormState((currentState) => ({
                      ...currentState,
                      result: event.target.value as RatingPayload['result']
                    }));
                  }}
                >
                  <option value="Win">Win</option>
                  <option value="Draw">Draw</option>
                  <option value="Loss">Loss</option>
                </select>
              </label>
            </div>

            
            {filteredPlayers.length === 0 ? (
              <p className="inline-message error">Không có cầu thủ cho vị trí đã chọn</p>
            ) : null}

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={formState.isStarter}
                onChange={(event) => {
                  setFormState((currentState) => ({
                    ...currentState,
                    isStarter: event.target.checked
                  }));
                }}
              />
              <span>Đá chính</span>
            </label>

            <button
              className="primary-button"
              type="submit"
              disabled={!selectedPlayerId}
            >
              Lưu điểm
            </button>

            {saveState.message ? (
              <p className={`inline-message ${saveState.tone}`}>{saveState.message}</p>
            ) : null}
          </form>

          {playersError ? <p className="status-error" style={{ marginTop: '16px' }}>{playersError}</p> : null}
        </article>

        <article className="panel status-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Evaluation Flow</p>
              <h2>Phong độ hiện tại</h2>
            </div>
            {selectedPlayer ? <span className="player-pill">{selectedPlayer.position}</span> : null}
          </div>

          <div className={`status-card ${statusTone}`}>
            <div className="status-topline">
              <strong>{selectedPlayer?.name ?? 'Chưa chọn cầu thủ'}</strong>
              <span>{loadingStatus ? 'Đang tải...' : formatStatusTitle(statusData?.status)}</span>
            </div>

            {statusError ? <p className="status-error">{statusError}</p> : null}

            {!statusError && statusData && 'averageScore' in statusData ? (
              <>
                <div className="score-badge">WMA {statusData.wmaScore.toFixed(1)}</div>
                <div className="status-grid">
                  <div>
                    <span className="metric-label">Số trận</span>
                    <strong>{statusData.matchCount}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Xu hướng</span>
                    <strong>{getTrendLabel(statusData.trendStatus)}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Variance</span>
                    <strong>{statusData.variance.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Ổn định</span>
                    <strong>{getStabilityLabel(statusData.stabilityLevel)}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Momentum</span>
                    <strong>{getMomentumLabel(statusData.momentumStatus)}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Prediction</span>
                    <strong>{statusData.predictedScore.toFixed(1)}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Confidence</span>
                    <strong>{getConfidenceLabel(statusData.confidence)} ({Math.round(statusData.confidence * 100)}%)</strong>
                  </div>
                  <div>
                    <span className="metric-label">Risk</span>
                    <strong>{statusData.riskLevel} ({statusData.riskScore.toFixed(1)})</strong>
                  </div>
                </div>

                <div className="status-grid" style={{ marginTop: '12px' }}>
                  <div>
                    <span className="metric-label">Hành động</span>
                    <strong>{statusData.action}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Khuyến nghị</span>
                    <strong>{getRecommendationLabel(statusData.recommendation)}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Fraud</span>
                    <strong>{statusData.fraudRisk ? 'ALERT' : 'CLEAR'}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Loss streak</span>
                    <strong>{statusData.lossStreak}</strong>
                  </div>
                </div>

                {statusData.fraudRisk ? (
                  <p className="inline-message error" style={{ marginTop: '12px' }}>
                    Fraud alert: {statusData.fraudReasons.join(', ')}
                  </p>
                ) : null}

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
            ) : null}

            {!statusError && statusData && 'message' in statusData ? (
              <div className="tracking-state">
                <p>{statusData.message}</p>
                <span>Nhập trận đầu tiên để bắt đầu đánh giá X̄.</span>
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <FormExtremesCard />
    </div>
  );
}