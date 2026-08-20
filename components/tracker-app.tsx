'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAppContext } from './app-context';
import { FormExtremesCard } from './form-extremes';
import { PerformanceTable } from './PerformanceTable';
import type { Match, PlayerStatusResponse, RiskLevel, TrendStatus } from '../lib/types';
import BulkRatingInputForm from './bulk-rating-input-form';
import { fetchWithDebug } from '../lib/client-api';
import {
  formatMatchDateTimeValue,
  formatMatchDateValue,
  sortRecentMatchesNewestFirst
} from '../lib/match-history';
import { createSubmitMatchDateTime, getVietnamDateInputValue } from '../lib/match-datetime';
import { TrendDashboard } from './trend-dashboard';

const RATING_HISTORY_ITEMS_PER_PAGE = 5;

function formatRatingDate(match: { matchDateTime?: string; matchDate?: string; matchTime?: string; createdAt?: string; updatedAt?: string }): string {
  return formatMatchDateTimeValue(match);
}

type AllPlayersFormRow = {
  name?: string;
  cardSeason?: string;
  season?: string;
  playerSeason?: string;
  cardType?: string;
  position?: string;
  matchCount?: number;
  wmaScore?: number;
  trendStatus?: TrendStatus;
  riskLevel?: RiskLevel;
};

function getCardSeasonValue(row: AllPlayersFormRow): string {
  const seasonValue = row.cardSeason ?? row.season ?? row.playerSeason ?? row.cardType ?? '';
  return typeof seasonValue === 'string' ? seasonValue.trim() : '';
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

function formatStatusTitle(status: PlayerStatusResponse['status'] | undefined): string {
  if (!status) {
    return 'Chưa có dữ liệu';
  }

  return status;
}

export function TrackerApp() {
  const { players, playersError, triggerRefresh } = useAppContext();
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [statusData, setStatusData] = useState<PlayerStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [ratingHistoryPage, setRatingHistoryPage] = useState(1);
  const [allPlayersFormData, setAllPlayersFormData] = useState<AllPlayersFormRow[]>([]);
  const [formDataLoading, setFormDataLoading] = useState(false);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [createForm, setCreateForm] = useState({
    matchDate: getVietnamDateInputValue(),
    opponentName: '',
    myScore: 0,
    opponentScore: 0,
    note: ''
  });
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [createMessage, setCreateMessage] = useState<{ tone: 'idle' | 'success' | 'error'; text: string } | null>(null);

  const selectedPlayer = players.find((player) => player.playerId === selectedPlayerId) ?? null;
  const sortedRatingHistory =
    statusData && 'recentMatches' in statusData
      ? sortRecentMatchesNewestFirst(statusData.recentMatches)
      : [];
  const ratingHistoryTotalPages = Math.max(
    1,
    Math.ceil(sortedRatingHistory.length / RATING_HISTORY_ITEMS_PER_PAGE)
  );
  const visibleRatingHistory = sortedRatingHistory.slice(
    (ratingHistoryPage - 1) * RATING_HISTORY_ITEMS_PER_PAGE,
    ratingHistoryPage * RATING_HISTORY_ITEMS_PER_PAGE
  );

  useEffect(() => {
    setRatingHistoryPage(1);
  }, [selectedPlayerId]);

  useEffect(() => {
    setRatingHistoryPage((currentPage) => Math.min(currentPage, ratingHistoryTotalPages));
  }, [ratingHistoryTotalPages]);

  useEffect(() => {
    if (selectedPlayerId && !players.some((player) => player.playerId === selectedPlayerId)) {
      if (players[0]?.playerId) {
        setSelectedPlayerId(players[0].playerId);
      } else {
        setSelectedPlayerId('');
        setStatusData(null);
        setStatusError(null);
      }

      return;
    }

    if (!selectedPlayerId && players[0]?.playerId) {
      setSelectedPlayerId(players[0].playerId);
    }
  }, [players, selectedPlayerId]);

  useEffect(() => {
    const loadAllPlayersForm = async () => {
      setFormDataLoading(true);
      try {
        const res = await fetchWithDebug('/api/form-extremes', undefined, { caller: 'TrackerApp.loadFormExtremes' });
        const data = (await res.json()) as { allForms?: AllPlayersFormRow[] };
        if (Array.isArray(data.allForms)) {
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
        const response = await fetchWithDebug(`/api/player-status?id=${encodeURIComponent(selectedPlayerId)}`, {
          signal: controller.signal
        }, { caller: 'TrackerApp.loadStatus' });

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
      const response = await fetchWithDebug(`/api/player-status?id=${encodeURIComponent(playerId)}`, undefined, { caller: 'TrackerApp.refreshPlayerStatus' });
      const errorPayload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(errorPayload.message ?? 'Không thể làm mới dữ liệu');
      }

      setStatusData(errorPayload as PlayerStatusResponse);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Không thể làm mới dữ liệu');
    }
  }

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
      const matchDateTime = createSubmitMatchDateTime();
      const res = await fetchWithDebug('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchDate: createForm.matchDate,
          matchDateTime,
          opponentName: createForm.opponentName,
          myScore: createForm.myScore,
          opponentScore: createForm.opponentScore,
          note: createForm.note
        })
      }, { caller: 'TrackerApp.handleCreateMatch' });

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
          <h2>Theo dõi phong độ của các cầu thủ thuộc đội bóng trong 5 trận gần nhất</h2>
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
            <strong>Real Madrid</strong>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gap: '20px' }}>
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Entry Flow</p>
              <h2>Nhập trận đấu</h2>
            </div>
          </div>

          {currentMatch ? (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 6 }}>
                <div><strong>Trận:</strong> {currentMatch.opponentName || 'N/A'} — {currentMatch.myScore}-{currentMatch.opponentScore}</div>
                <div><strong>Ngày:</strong> {formatMatchDateValue(currentMatch)}</div>
                <div><strong>Kết quả:</strong> {currentMatch.result}</div>
              </div>

              <button
                type="button"
                className="button button-secondary"
                onClick={() => setCurrentMatch(null)}
              >
                Tạo trận mới
              </button>
            </div>
          ) : (
            <form className="form-stack" onSubmit={handleCreateMatch}>
              <div className="field-grid">
                <label className="field">
                  <span>Ngày thi đấu</span>
                  <input
                    type="date"
                    value={createForm.matchDate}
                    onChange={(e) => setCreateForm({ ...createForm, matchDate: e.target.value })}
                    required
                  />
                </label>

                <label className="field">
                  <span>Đối thủ</span>
                  <input
                    type="text"
                    value={createForm.opponentName}
                    onChange={(e) => setCreateForm({ ...createForm, opponentName: e.target.value })}
                    placeholder="Ví dụ: Arsenal"
                  />
                </label>
              </div>

              <div className="field-grid">
                <label className="field">
                  <span>Tỉ số đội mình</span>
                  <input
                    type="number"
                    min="0"
                    value={createForm.myScore}
                    onChange={(e) => setCreateForm({ ...createForm, myScore: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                    required
                  />
                </label>
                <label className="field">
                  <span>Tỉ số đối thủ</span>
                  <input
                    type="number"
                    min="0"
                    value={createForm.opponentScore}
                    onChange={(e) => setCreateForm({ ...createForm, opponentScore: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                    required
                  />
                </label>
              </div>

              <label className="field">
                <span>Ghi chú</span>
                <input
                  type="text"
                  value={createForm.note}
                  onChange={(e) => setCreateForm({ ...createForm, note: e.target.value })}
                  placeholder="Ghi chú trận đấu"
                />
              </label>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button className="primary-button" type="submit" disabled={creatingMatch}>
                  {creatingMatch ? 'Đang tạo...' : 'Tạo trận'}
                </button>
              </div>

              {createMessage ? (
                <p className={`inline-message ${createMessage.tone === 'error' ? 'error' : 'success'}`}>
                  {createMessage.text}
                </p>
              ) : null}
            </form>
          )}

          {playersError ? <p className="status-error" style={{ marginTop: '16px' }}>{playersError}</p> : null}
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Bulk Rating Table</p>
              <h2>Nhập điểm cầu thủ</h2>
            </div>
          </div>

          {currentMatch ? (
            <BulkRatingInputForm
              match={currentMatch}
              onRatingsSaved={async ({ created, updated }) => {
                setCreateMessage({ tone: 'success', text: `Lưu ${created + updated} đánh giá thành công` });
                try {
                  // trigger global refresh for components that listen
                  triggerRefresh();

                  // refresh current selected player's status if any
                  if (selectedPlayerId) {
                    await refreshPlayerStatus(selectedPlayerId);
                  }

                  // reload form-extremes (all players form data)
                  setFormDataLoading(true);
                  try {
                    const res = await fetchWithDebug('/api/form-extremes', undefined, { caller: 'TrackerApp.reloadFormExtremesAfterSave' });
                    const data = (await res.json()) as { allForms?: AllPlayersFormRow[] };
                    if (Array.isArray(data.allForms)) {
                      setAllPlayersFormData(data.allForms);
                    }
                  } catch (err) {
                    console.error('Failed to reload form-extremes after save', err);
                  } finally {
                    setFormDataLoading(false);
                  }
                } catch (err) {
                  console.error('onRatingsSaved handler failed', err);
                }
              }}
              onCancel={() => setCurrentMatch(null)}
            />
          ) : (
            <p className="tracking-state" style={{ margin: 0 }}>
              Tạo trận đấu trước để nhập bảng điểm hàng loạt.
            </p>
          )}
        </article>

        <article className="panel status-panel evaluation-flow-card">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Evaluation Flow</p>
              <h2>Phong độ hiện tại</h2>
            </div>
            <label className="field" style={{ minWidth: 220 }}>
              <span>Chọn cầu thủ</span>
              <select
                value={selectedPlayerId}
                onChange={(event) => setSelectedPlayerId(event.target.value)}
              >
                <option value="">Chọn cầu thủ</option>
                {players.map((player) => (
                  <option key={player.playerId} value={player.playerId}>
                    {player.name} · {player.position}
                  </option>
                ))}
              </select>
            </label>
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
                    Chưa đủ dữ liệu ({statusData.matchCount} trận)
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
                    <span className="metric-label">Độ biến động</span>
                    <strong>{statusData.variance.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Ổn định</span>
                    <strong>{getStabilityLabel(statusData.stabilityLevel)}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Đà phong độ</span>
                    <strong>{getMomentumLabel(statusData.momentumStatus)}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Điểm dự đoán</span>
                    <strong>{statusData.predictedScore.toFixed(1)}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Độ tin cậy</span>
                    <strong>{getConfidenceLabel(statusData.confidence)} ({Math.round(statusData.confidence * 100)}%)</strong>
                  </div>
                  <div>
                    <span className="metric-label">Rủi ro</span>
                    <strong>{statusData.riskLevel} ({statusData.riskScore.toFixed(1)})</strong>
                  </div>
                </div>

                <div className="status-grid status-action-grid" style={{ marginTop: '12px' }}>
                  <div>
                    <span className="metric-label">Hành động</span>
                    <strong>{statusData.action}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Khuyến nghị</span>
                    <strong>{getRecommendationLabel(statusData.recommendation)}</strong>
                  </div>
                  <div className={statusData.fraudRisk ? 'status-fraud-cell alert' : 'status-fraud-cell'}>
                    <span className="metric-label">Cảnh báo bất thường</span>
                    <strong>{statusData.fraudRisk ? 'CÓ' : 'KHÔNG'}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Chuỗi thua</span>
                    <strong>{statusData.lossStreak}</strong>
                  </div>
                </div>

                {statusData.fraudRisk ? (
                  <p className="inline-message error status-fraud-alert" style={{ marginTop: '12px' }}>
                    Phong độ bất thường: {statusData.fraudReasons.join(', ')}
                  </p>
                ) : null}

                <div className="recent-list">
                  {visibleRatingHistory.map((match) => (
                    <div key={match.sk} className="recent-item">
                      <span>{formatRatingDate(match)}</span>
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
                        {(match.goals ?? 0) > 0 || (match.assists ?? 0) > 0
                          ? ` · Bàn ${match.goals ?? 0} · Kiến tạo ${match.assists ?? 0}`
                          : ''}
                        {match.note ? ` · ${match.note}` : ''}
                      </small>
                    </div>
                  ))}
                </div>
                <div className="match-history-pagination" aria-label="Phân trang lịch sử điểm đánh giá">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={ratingHistoryPage === 1}
                    onClick={() => setRatingHistoryPage((page) => Math.max(1, page - 1))}
                  >
                    Trang trước
                  </button>
                  <span>Trang {ratingHistoryPage}/{ratingHistoryTotalPages}</span>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={ratingHistoryPage === ratingHistoryTotalPages}
                    onClick={() =>
                      setRatingHistoryPage((page) => Math.min(ratingHistoryTotalPages, page + 1))
                    }
                  >
                    Trang sau
                  </button>
                </div>
              </>
            ) : null}

            {!statusError && statusData && 'message' in statusData ? (
              <div className="tracking-state">
                <p>{statusData.message}</p>
                <span>Cần ít nhất 3 trận để bắt đầu đánh giá và đưa ra khuyến nghị.</span>
              </div>
            ) : null}
          </div>
          {statusData && 'recentMatches' in statusData ? <TrendDashboard matches={statusData.recentMatches} prediction={'predictedScore' in statusData ? statusData.predictedScore : undefined} /> : null}
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

        <PerformanceTable
          players={allPlayersFormData.map((form) => ({
            name: form.name ?? 'N/A',
            cardSeason: getCardSeasonValue(form),
            position: form.position ?? '',
            matchCount: form.matchCount,
            wmaScore: form.wmaScore,
            trendStatus: form.trendStatus as TrendStatus,
            riskLevel: form.riskLevel as RiskLevel
          }))}
          title="Phong độ toàn đội"
          loading={formDataLoading}
        />
      </article>
    </div>
  );
}
