'use client';

import { useEffect, useState } from 'react';
import type { AnalysisWindow, PlayerStatusResponse, RatingPayload, WeightProfile } from '../lib/types';
import { useAppContext } from './app-context';
import { fetchWithDebug } from '../lib/client-api';
import { formatMatchDateTimeValue, sortRecentMatchesNewestFirst } from '../lib/match-history';
import { ConfirmationDialog } from './confirmation-dialog';

const RATING_HISTORY_ITEMS_PER_PAGE = 5;

function formatRatingDate(match: { matchDateTime?: string; matchDate?: string; matchTime?: string; createdAt?: string; updatedAt?: string }): string {
  return formatMatchDateTimeValue(match);
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
  const [analysisWindow, setAnalysisWindow] = useState<AnalysisWindow>(5);
  const [weightProfile, setWeightProfile] = useState<WeightProfile>('WMA');
  const [filters, setFilters] = useState({ season: '', competition: '', matchType: '' });
  const [ratingHistoryPage, setRatingHistoryPage] = useState(1);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
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
        const query = new URLSearchParams({ id: selectedPlayerId || '', window: String(analysisWindow), weightProfile });
        Object.entries(filters).forEach(([key, value]) => { if (value.trim()) query.set(key, value.trim()); });
        const res = await fetchWithDebug(`/api/player-status?${query}`, undefined, { caller: 'PlayerDetail.loadStatus' });
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
  }, [selectedPlayerId, refreshTrigger, analysisWindow, weightProfile, filters.season, filters.competition, filters.matchType]);

  useEffect(() => {
    setRatingHistoryPage(1);
  }, [selectedPlayerId]);

  async function handleResetData() {
    if (!selectedPlayerId) {
      setResetState({ message: 'Không có cầu thủ nào được chọn', type: 'error' });
      return;
    }

    setResetState(null);
    setResetting(true);

    try {
      const result = await resetPlayerData(selectedPlayerId);
      if (!result.ok) throw new Error(result.message ?? 'Failed');

      setResetState({
        message: 'Đã reset lịch sử trận đấu thành công',
        type: 'success'
      });
      triggerRefresh();
      setShowResetConfirm(false);
    } catch (err) {
      setResetState({
        message: err instanceof Error ? err.message : 'Không thể reset lịch sử',
        type: 'error'
      });
    } finally {
      setResetting(false);
    }
  }

  const statusTone = statusData && 'color' in statusData ? statusData.color : 'neutral';
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
    setRatingHistoryPage((currentPage) => Math.min(currentPage, ratingHistoryTotalPages));
  }, [ratingHistoryTotalPages]);

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
            <div className="analysis-heading">
              <h3>Thông Tin Cầu Thủ</h3>
              <label>Cửa sổ phân tích
                <select value={analysisWindow} onChange={(event) => setAnalysisWindow(Number(event.target.value) as AnalysisWindow)}>
                  <option value={5}>5 trận</option>
                  <option value={10}>10 trận</option>
                  <option value={20}>20 trận</option>
                </select>
              </label>
              <label>Profile
                <select value={weightProfile} onChange={(event) => setWeightProfile(event.target.value as WeightProfile)}>
                  <option value="WMA">WMA</option><option value="DECAY">Decay</option>
                </select>
              </label>
            </div>
            <div className="match-history-filters"><label>Mùa giải<input value={filters.season} onChange={e=>setFilters({...filters,season:e.target.value})}/></label><label>Giải đấu<input value={filters.competition} onChange={e=>setFilters({...filters,competition:e.target.value})}/></label><label>Loại trận<select value={filters.matchType} onChange={e=>setFilters({...filters,matchType:e.target.value})}><option value="">Tất cả</option><option value="FRIENDLY">Giao hữu</option><option value="LEAGUE">Giải đấu</option><option value="CUP">Cúp</option><option value="RANKED">Xếp hạng</option><option value="TRAINING">Tập luyện</option></select></label></div>
            {statusData ? (
              <div>
                <strong>{statusData.name}</strong>
                <div style={{ marginTop: 8 }}>
                  {('matchCount' in statusData && statusData.matchCount < 3) ? (
                    <div className="score-badge" style={{ textAlign: 'center', color: '#999' }}>
                      Chưa đủ dữ liệu ({statusData.matchCount} trận)
                    </div>
                  ) : ('wmaScore' in statusData) ? (
                    <div className="score-badge">
                      <div>Đang phân tích {statusData.analyzedMatchCount}/{statusData.analysisWindow} trận đã chọn</div>
                      <div>Điểm trung bình: {statusData.averageScore.toFixed(1)}</div>
                      <div style={{ marginTop: '4px' }}>{statusData.weightProfile === 'DECAY' ? 'Decay' : 'WMA'}: {statusData.wmaScore.toFixed(1)}</div>
                      <div style={{ marginTop: '4px' }}>Xu hướng: {getTrendLabel(statusData.trendStatus)}</div>
                    </div>
                  ) : (
                    <div className="score-badge">WMA N/A</div>
                  )}
                </div>
                {'wmaScore' in statusData ? (
                  <>
                    <div className="status-grid" style={{ marginTop: 12 }}>
                      <div><span className="metric-label">Xu hướng</span><strong>{getTrendLabel(statusData.trendStatus)}</strong></div>
                      <div><span className="metric-label">Độ biến động</span><strong>{statusData.variance.toFixed(2)}</strong></div>
                      <div><span className="metric-label">Độ ổn định</span><strong>{getStabilityLabel(statusData.stabilityLevel)}</strong></div>
                      <div><span className="metric-label">Đà phong độ</span><strong>{getMomentumLabel(statusData.momentumStatus)}</strong></div>
                      <div><span className="metric-label">Điểm dự đoán</span><strong>{statusData.predictedScore.toFixed(1)}</strong></div>
                      <div><span className="metric-label">Rủi ro</span><strong>{statusData.riskLevel} ({statusData.riskScore.toFixed(1)})</strong></div>
                      <div><span className="metric-label">Độ tin cậy</span><strong>{Math.round(statusData.confidence * 100)}%</strong></div>
                      <div><span className="metric-label">Khuyến nghị</span><strong>{getRecommendationLabel(statusData.recommendation)}</strong></div>
                    </div>

                    {'adjustedAverageScore' in statusData ? (
                      <div className="status-grid" style={{ marginTop: 12 }}>
                        <div><span className="metric-label">Điểm trung bình</span><strong>{statusData.averageScore.toFixed(1)}</strong></div>
                        <div><span className="metric-label">Điểm điều chỉnh</span><strong>{statusData.adjustedAverageScore.toFixed(1)}</strong></div>
                        <div><span className="metric-label">Ảnh hưởng trận</span><strong>{statusData.matchImpactAvg.toFixed(2)}</strong></div>
                        <div><span className="metric-label">Thắng đậm</span><strong>{statusData.bigWinCountInWindow} ({(statusData.bigWinRate * 100).toFixed(0)}%)</strong></div>
                        <div><span className="metric-label">Thua đậm</span><strong>{statusData.bigLossCountInWindow} ({(statusData.bigLossRate * 100).toFixed(0)}%)</strong></div>
                      </div>
                    ) : null}

                    <section className="analysis-section" aria-labelledby="breakdown-heading">
                      <h4 id="breakdown-heading">Prediction Breakdown</h4>
                      <p>Đầu vào: {statusData.analyzedMatchCount} trận, {statusData.totalMinutes} phút · Profile {statusData.weightProfile} · Vị trí {statusData.positionGroup}.</p>
                      <div className="breakdown-grid">
                        {statusData.breakdown.map((item) => (
                          <article key={item.key} className={`breakdown-item ${item.impact.toLowerCase()}`}>
                            <div><strong>{item.label}</strong><span>{item.value}</span></div>
                            <p>{item.meaning}</p>
                            <small>{item.impact === 'POSITIVE' ? 'Tích cực' : item.impact === 'NEGATIVE' ? 'Tiêu cực' : 'Trung tính'}{typeof item.contribution === 'number' ? ` · Đóng góp ${item.contribution >= 0 ? '+' : ''}${item.contribution.toFixed(2)}` : ''}</small>
                          </article>
                        ))}
                      </div>
                      {statusData.lowMinutesWarnings.map((warning, index) => <p className="inline-message" key={`${warning}-${index}`}>{warning}</p>)}
                    </section>
                    <section className="analysis-section">
                      <h4>Risk Breakdown</h4>
                      <div className="status-grid"><div><span className="metric-label">Variance</span><strong>{statusData.variance.toFixed(2)}</strong></div><div><span className="metric-label">Discipline</span><strong>{statusData.disciplineScore?.toFixed(0) ?? '—'}/100</strong></div><div><span className="metric-label">Momentum</span><strong>{statusData.momentum.toFixed(2)}</strong></div><div><span className="metric-label">Confidence</span><strong>{Math.round(statusData.confidence * 100)}%</strong></div><div><span className="metric-label">Cỡ mẫu hiệu dụng</span><strong>{statusData.effectiveSampleSize}</strong></div></div>
                      <p>{statusData.riskLevel === 'HIGH' ? 'Hệ thống cảnh báo vì có nhiều tín hiệu rủi ro.' : 'Chưa có đủ tín hiệu đồng thời để đưa ra cảnh báo mạnh.'}</p>
                    </section>
                    <section className="analysis-section">
                      <h4>Recommendation Breakdown</h4>
                      <p><strong>{statusData.recommendationStatus === 'INSUFFICIENT' ? 'Chưa đủ cơ sở để khuyến nghị' : getRecommendationLabel(statusData.recommendation)}</strong></p>
                      <p>{statusData.recommendationReason}</p>
                      <p>Độ tin cậy: {Math.round(statusData.confidence * 100)}%. Cần theo dõi: {statusData.recommendationWatchouts.join(' ')}</p>
                      <h5>Thống kê sự kiện</h5>
                      <p>Bàn {statusData.eventStats.goals.raw}{statusData.eventStats.goals.per90 === null ? '' : ` (${statusData.eventStats.goals.per90}/90)`} · Kiến tạo {statusData.eventStats.assists.raw}{statusData.eventStats.assists.per90 === null ? '' : ` (${statusData.eventStats.assists.per90}/90)`} · Thẻ vàng {statusData.eventStats.yellowCards.raw} · Thẻ đỏ {statusData.eventStats.redCards.raw} · Lỗi {statusData.eventStats.fouls.raw}</p>
                      {statusData.eventStats.sampleWarning ? <p className="inline-message">{statusData.eventStats.sampleWarning} Số gốc vẫn được giữ để tham khảo.</p> : null}
                    </section>

                    <section className="analysis-section" aria-labelledby="backtest-heading">
                      <h4 id="backtest-heading">Đối chiếu dự đoán</h4>
                      {statusData.backtest.sampleSize ? <>
                        <div className="backtest-summary">
                          <div><span>MAE</span><strong>{statusData.backtest.mae?.toFixed(2)}</strong></div>
                          <div><span>Số trận</span><strong>{statusData.backtest.sampleSize}</strong></div>
                          <div><span>Dự đoán TB</span><strong>{statusData.backtest.averagePrediction?.toFixed(2)}</strong></div>
                          <div><span>Thực tế TB</span><strong>{statusData.backtest.averageActual?.toFixed(2)}</strong></div>
                        </div>
                        <div className="analysis-table-wrap"><table className="analysis-table"><thead><tr><th>Trận</th><th>Dự đoán</th><th>Thực tế</th><th>Sai số</th></tr></thead><tbody>
                          {statusData.backtest.recent.map((item) => <tr key={item.matchKey}><td>{item.matchDate ? new Date(item.matchDate).toLocaleDateString('vi-VN') : item.matchKey.replace('MATCH#', '')}</td><td>{item.predicted.toFixed(1)}</td><td>{item.actual.toFixed(1)}</td><td>{item.error.toFixed(2)}</td></tr>)}
                        </tbody></table></div>
                      </> : <p className="analysis-empty">Chưa đủ dữ liệu dự đoán lịch sử để backtest. Cần ít nhất 4 trận có rating.</p>}
                    </section>
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
                {'confidenceWarning' in statusData && statusData.confidenceWarning ? (
                  <p className="inline-message" style={{ marginTop: '12px' }}>{statusData.confidenceWarning}</p>
                ) : null}
                {'fraudRisk' in statusData && statusData.fraudRisk ? (
                  <p className="inline-message error" style={{ marginTop: '12px' }}>
                    Cảnh báo phong độ bất thường: {statusData.fraudReasons.join(', ')}. Cần theo dõi thêm trước khi đưa ra kết luận.
                  </p>
                ) : null}
                {'wmaScore' in statusData ? <details className="analysis-inputs">
                  <summary>Dữ liệu đầu vào ({statusData.analyzedMatchCount} trận)</summary>
                  <div className="analysis-table-wrap"><table className="analysis-table"><thead><tr><th>Ngày/trận</th><th>Rating</th><th>Bàn</th><th>Kiến tạo</th><th>Thẻ / lỗi</th><th>Dự đoán</th></tr></thead><tbody>
                    {sortedRatingHistory.slice(0, statusData.analyzedMatchCount).map((match) => {
                      const tested = statusData.backtest.recent.find((item) => item.matchKey === match.sk);
                      return <tr key={match.sk}><td>{formatRatingDate(match)}{match.opponentName ? ` · ${match.opponentName}` : ''}</td><td>{match.score.toFixed(1)}</td><td>{match.goals ?? 0}</td><td>{match.assists ?? 0}</td><td>{match.yellowCards ?? 0}V · {match.redCards ?? 0}Đ · {match.fouls ?? 0} lỗi</td><td>{tested ? tested.predicted.toFixed(1) : '—'}</td></tr>;
                    })}
                  </tbody></table></div>
                </details> : null}
              </div>
            ) : statusData && !loadingStatus && !statusError ? (
              <div className="tracking-state">
                <p>Chưa có lịch sử điểm đánh giá.</p>
                <span>Nhập điểm cho cầu thủ ở Evaluation Flow để bắt đầu theo dõi.</span>
              </div>
            ) : null}

            {resetState && (
              <p className={`inline-message ${resetState.type}`}>{resetState.message}</p>
            )}

            <button
              className="secondary-button"
              onClick={() => setShowResetConfirm(true)}
              style={{ marginTop: '16px', width: '100%' }}
            >
              🔄 Reset Lịch Sử
            </button>
          </div>
        </div>
      )}
      <ConfirmationDialog
        open={showResetConfirm}
        title="Reset lịch sử cầu thủ?"
        description="Toàn bộ lịch sử điểm của cầu thủ sẽ bị xóa khỏi cả hai chiều dữ liệu. Hành động này không thể hoàn tác."
        confirmLabel="Reset lịch sử"
        busyLabel="Đang reset..."
        busy={resetting}
        danger
        onCancel={() => {
          if (!resetting) setShowResetConfirm(false);
        }}
        onConfirm={() => void handleResetData()}
      />
    </div>
  );
}
