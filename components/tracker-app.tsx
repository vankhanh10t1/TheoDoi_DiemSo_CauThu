'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAppContext } from './app-context';
import { FormExtremesCard } from './form-extremes';
import { PerformanceTable } from './PerformanceTable';
import {
  filterPlayersByPosition,
  getDetailedPositionsByGroup,
  isDetailedPositionForGroup,
  normalizeDetailedPosition,
  POSITION_GROUPS
} from '../lib/positions';
import type { PlayerStatusResponse, RatingPayload, RiskLevel, TrendStatus, Match } from '../lib/types';
import BulkRatingInputForm from './bulk-rating-input-form';

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

function normalizeMarginFlags(result: RatingPayload['result'], isBigWin: boolean, isBigLoss: boolean) {
  if (result === 'Win') {
    return { isBigWin, isBigLoss: false };
  }

  if (result === 'Loss') {
    return { isBigWin: false, isBigLoss };
  }

  return { isBigWin: false, isBigLoss: false };
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
  detailedPosition: 'GK',
  yellowCards: 0,
  redCards: 0,
  fouls: 0,
  isBigWin: false,
  isBigLoss: false
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
  const [allPlayersFormData, setAllPlayersFormData] = useState<any[]>([]);
  const [formDataLoading, setFormDataLoading] = useState(false);

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
    const loadAllPlayersForm = async () => {
      setFormDataLoading(true);
      try {
        const res = await fetch('/api/form-extremes');
        const data = (await res.json()) as any;
        if (data.allForms && Array.isArray(data.allForms)) {
          setAllPlayersFormData(data.allForms);
        }
      } catch (error) {
        console.error('Failed to load all players form:', error);
      } finally {
        setFormDataLoading(false);
      }
    };

    loadAllPlayersForm();
  }, []);

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

  // Match-first flow state
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [createForm, setCreateForm] = useState({ matchDate: '', opponentName: '', myScore: 0, opponentScore: 0, note: '' });
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [createMessage, setCreateMessage] = useState<{ tone: 'idle' | 'success' | 'error'; text: string } | null>(null);

  async function handleCreateMatch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateMessage(null);

    // Basic validation
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(createForm.matchDate)) {
      setCreateMessage({ tone: 'error', text: 'Ngày phải có định dạng YYYY-MM-DD' });
      return;
    }
    if (!Number.isInteger(createForm.myScore) || !Number.isInteger(createForm.opponentScore) || createForm.myScore < 0 || createForm.opponentScore < 0) {
      setCreateMessage({ tone: 'error', text: 'Tỉ số phải là số nguyên không âm' });
      return;
    }

    setCreatingMatch(true);
    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm)
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || payload.message || 'Không thể tạo trận');
      }

      setCurrentMatch(payload.match as Match);
      setCreateMessage({ tone: 'success', text: 'Tạo trận thành công — nhập điểm cho trận này.' });
    } catch (err) {
      setCreateMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Lỗi tạo trận' });
    } finally {
      setCreatingMatch(false);
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

            <div className="field-grid">
              <label className="field">
                <span>Thẻ vàng</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={(formState.yellowCards ?? 0)}
                  onChange={(event) => {
                    const v = Math.max(0, Math.floor(Number(event.target.value) || 0));
                    setFormState((currentState) => ({ ...currentState, yellowCards: v }));
                  }}
                />
              </label>

              <label className="field">
                <span>Thẻ đỏ</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={(formState.redCards ?? 0)}
                  onChange={(event) => {
                    const v = Math.max(0, Math.floor(Number(event.target.value) || 0));
                    setFormState((currentState) => ({ ...currentState, redCards: v }));
                  }}
                />
              </label>

              <label className="field">
                <span>Fouls</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={(formState.fouls ?? 0)}
                  onChange={(event) => {
                    const v = Math.max(0, Math.floor(Number(event.target.value) || 0));
                    setFormState((currentState) => ({ ...currentState, fouls: v }));
                  }}
                />
              </label>
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

          {/* Match-first flow: create match, then bulk rating */}
          {currentMatch ? (
            <div>
              <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: 12 }}>
                <div><strong>Trận:</strong> {currentMatch.opponentName || 'N/A'} — {currentMatch.myScore}-{currentMatch.opponentScore}</div>
                <div><strong>Ngày:</strong> {new Date(currentMatch.matchDate).toLocaleDateString('vi-VN')}</div>
                <div><strong>Kết quả:</strong> {currentMatch.result}</div>
              </div>

              <BulkRatingInputForm
                match={currentMatch}
                onRatingsSaved={({ created, updated }) => {
                  setCreateMessage({ tone: 'success', text: `Lưu ${created + updated} đánh giá thành công` });
                }}
                onCancel={() => setCurrentMatch(null)}
              />
            </div>
          ) : (
            <form className="form-stack" onSubmit={handleCreateMatch}>
              <label className="field">
                <span>Ngày thi đấu (YYYY-MM-DD)</span>
                <input type="text" value={createForm.matchDate} onChange={(e) => setCreateForm({ ...createForm, matchDate: e.target.value })} required />
              </label>

              <label className="field">
                <span>Đối thủ</span>
                <input type="text" value={createForm.opponentName} onChange={(e) => setCreateForm({ ...createForm, opponentName: e.target.value })} />
              </label>

              <div className="field-grid">
                <label className="field">
                  <span>Tỉ số đội mình</span>
                  <input type="number" min="0" value={createForm.myScore} onChange={(e) => setCreateForm({ ...createForm, myScore: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} required />
                </label>
                <label className="field">
                  <span>Tỉ số đối thủ</span>
                  <input type="number" min="0" value={createForm.opponentScore} onChange={(e) => setCreateForm({ ...createForm, opponentScore: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} required />
                </label>
              </div>

              <label className="field">
                <span>Ghi chú</span>
                <input type="text" value={createForm.note} onChange={(e) => setCreateForm({ ...createForm, note: e.target.value })} />
              </label>

              <div style={{ display: 'flex', gap: 12 }}>
                <button className="primary-button" type="submit" disabled={creatingMatch}>{creatingMatch ? 'Đang tạo...' : 'Tạo trận'} </button>
              </div>

              {createMessage ? <p className={`inline-message ${createMessage.tone === 'error' ? 'error' : 'success'}`}>{createMessage.text}</p> : null}
            </form>
          )}

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
                {statusData.matchCount < 3 ? (
                  <div className="score-badge" style={{ textAlign: 'center', color: '#999' }}>
                    Not enough data ({statusData.matchCount} match{statusData.matchCount !== 1 ? 'es' : ''})
                  </div>
                ) : (
                  <div className="score-badge">
                    <div>Average: {statusData.averageScore.toFixed(1)}</div>
                    <div style={{ marginTop: '4px' }}>WMA: {statusData.wmaScore.toFixed(1)}</div>
                    <div style={{ marginTop: '4px' }}>Trend: {getTrendLabel(statusData.trendStatus)}</div>
                  </div>
                )}
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
                        <span style={{ marginLeft: 8 }}>
                          🟨{match.yellowCards ?? 0} 
                          🟥{match.redCards ?? 0} 
                          ⚠️{match.fouls ?? 0}
                        </span>
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

      <article className="panel" style={{ marginTop: '24px' }}>
        <div className="panel-header">
          <div>
            <p className="panel-kicker">All Players</p>
            <h2>Bảng phong độ toàn đội</h2>
          </div>
          <span className="player-pill">{allPlayersFormData.length} cầu thủ</span>
        </div>

        {formDataLoading ? (
          <p style={{ textAlign: 'center', padding: '24px' }}>Đang tải dữ liệu...</p>
        ) : allPlayersFormData.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '24px', color: '#999' }}>Chưa có dữ liệu cầu thủ</p>
        ) : (
          <PerformanceTable
            players={allPlayersFormData.map((form) => ({
              name: form.name,
              cardSeason: form.position,
              position: form.position,
              matchCount: form.matchCount,
              wmaScore: form.wmaScore,
              trendStatus: form.trendStatus as TrendStatus,
              riskLevel: form.riskLevel as RiskLevel
            }))}
            title="Phong độ toàn đội"
          />
        )}
      </article>
    </div>
  );
}