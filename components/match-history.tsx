'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Match, PlayerMatchRatingDetail } from '../lib/types';
import { fetchWithDebug } from '../lib/client-api';
import { getMatchSortDateTime, sortMatchHistoryNewestFirst } from '../lib/match-history';

const ITEMS_PER_PAGE = 10;

type MatchListResponse = {
  matches?: Match[];
  error?: string;
};

type MatchDetailResponse = {
  ratings?: PlayerMatchRatingDetail[];
  error?: string;
};

function formatMatchDateTime(match: Match): string {
  const date = new Date(getMatchSortDateTime(match));
  return Number.isNaN(date.getTime())
    ? match.createdAt
    : new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(date);
}

function getResultLabel(result: Match['result']): string {
  if (result === 'WIN') return 'Thắng';
  if (result === 'DRAW') return 'Hòa';
  return 'Thua';
}

export function MatchHistory() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [pageError, setPageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [ratingsByMatch, setRatingsByMatch] = useState<Record<string, PlayerMatchRatingDetail[]>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  async function loadMatches() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithDebug('/api/matches', undefined, { caller: 'MatchHistory.loadMatches' });
      const payload = (await response.json()) as MatchListResponse;
      if (!response.ok) throw new Error(payload.error || 'Không thể tải lịch sử trận.');
      setMatches(Array.isArray(payload.matches) ? sortMatchHistoryNewestFirst(payload.matches).slice(0, 100) : []);
      setPage(1);
      setPageInput('1');
      setPageError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải lịch sử trận.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMatches();
  }, []);

  const totalPages = Math.max(1, Math.ceil(matches.length / ITEMS_PER_PAGE));
  const visibleMatches = useMemo(
    () => matches.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [matches, page]
  );

  function goToPage(nextPage: number) {
    const clampedPage = Math.min(totalPages, Math.max(1, Math.trunc(nextPage)));
    setPage(clampedPage);
    setPageInput(String(clampedPage));
    setPageError(null);
  }

  function handlePageJump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pageInput.trim()) {
      setPageError('Vui lòng nhập số trang.');
      return;
    }

    const requestedPage = Number(pageInput);
    if (!Number.isFinite(requestedPage)) {
      setPageError('Số trang không hợp lệ.');
      return;
    }
    goToPage(requestedPage);
  }

  async function toggleDetail(matchId: string) {
    if (expandedMatchId === matchId) {
      setExpandedMatchId(null);
      return;
    }

    setExpandedMatchId(matchId);
    setDetailError(null);
    if (ratingsByMatch[matchId]) return;

    setDetailLoadingId(matchId);
    try {
      const response = await fetchWithDebug(`/api/matches/${matchId}/ratings`, undefined, {
        caller: 'MatchHistory.toggleDetail'
      });
      const payload = (await response.json()) as MatchDetailResponse;
      if (!response.ok) throw new Error(payload.error || 'Không thể tải chi tiết trận.');
      setRatingsByMatch((current) => ({
        ...current,
        [matchId]: (payload.ratings ?? []).filter((rating) => Number.isFinite(rating.rating))
      }));
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : 'Không thể tải chi tiết trận.');
    } finally {
      setDetailLoadingId(null);
    }
  }

  return (
    <section className="screen-panel">
      <div className="screen-header">
        <div>
          <p className="panel-kicker">Tối đa 100 trận gần nhất</p>
          <h2>Lịch sử trận</h2>
        </div>
        <button className="secondary-button" type="button" onClick={() => void loadMatches()} disabled={loading}>
          Làm mới
        </button>
      </div>

      {loading ? <div className="panel tracking-state">Đang tải lịch sử trận...</div> : null}
      {error ? <div className="panel inline-message error">{error}</div> : null}
      {!loading && !error && matches.length === 0 ? (
        <div className="panel tracking-state">
          <p>Chưa có trận đấu nào được lưu.</p>
          <span>Tạo trận mới ở mục Rating để bắt đầu lịch sử.</span>
        </div>
      ) : null}

      {!loading && !error && matches.length > 0 ? (
        <>
          <div className="match-history-list">
            {visibleMatches.map((match) => {
              const ratings = ratingsByMatch[match.id];
              const expanded = expandedMatchId === match.id;
              const displayedRatingCount = match.ratingCount ?? ratings?.length;
              return (
                <article className="panel match-history-card" key={match.id}>
                  <div className="match-history-main">
                    <div>
                      <p className="match-history-time">{formatMatchDateTime(match)}</p>
                      <h3>{match.opponentName ? `Đối thủ: ${match.opponentName}` : 'Không ghi tên đối thủ'}</h3>
                    </div>
                    <span className={`match-result-badge ${match.result.toLowerCase()}`}>
                      {getResultLabel(match.result)}
                    </span>
                  </div>

                  <div className="match-history-meta">
                    <span><strong>Tỉ số:</strong> {match.myScore} - {match.opponentScore}</span>
                    {typeof displayedRatingCount === 'number' ? (
                      <span><strong>Đã chấm:</strong> {displayedRatingCount} cầu thủ</span>
                    ) : null}
                    {match.note ? <span className="match-history-note"><strong>Ghi chú:</strong> {match.note}</span> : null}
                  </div>

                  <button className="tertiary-button" type="button" onClick={() => void toggleDetail(match.id)}>
                    {expanded ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                  </button>

                  {expanded ? (
                    <div className="match-history-detail">
                      {detailLoadingId === match.id ? <p>Đang tải chi tiết...</p> : null}
                      {detailError && detailLoadingId !== match.id ? <p className="status-error">{detailError}</p> : null}
                      {ratings && ratings.length === 0 ? <p>Trận này chưa có điểm cầu thủ.</p> : null}
                      {ratings?.map((rating) => (
                        <div className="match-rating-row" key={rating.id}>
                          <div className="match-rating-player">
                            <strong>{rating.playerName}</strong>
                            <span>
                              {rating.cardSeason || 'Không có mùa thẻ'} · {rating.position || rating.playerPosition || 'Không có vị trí'}
                            </span>
                          </div>
                          <strong className="match-rating-score">{rating.rating.toFixed(1)}</strong>
                          <div className="match-rating-stats">
                            <span>Bàn thắng: {rating.goals ?? 0}</span>
                            <span>Kiến tạo: {rating.assists ?? 0}</span>
                            <span>Thẻ vàng: {rating.yellowCards ?? 0}</span>
                            <span>Thẻ đỏ: {rating.redCards ?? 0}</span>
                            <span>Lỗi: {rating.fouls ?? 0}</span>
                          </div>
                          {rating.note ? <p className="match-rating-note">Ghi chú: {rating.note}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="match-history-pagination" aria-label="Phân trang lịch sử trận">
            <button className="secondary-button" type="button" disabled={page === 1} onClick={() => goToPage(page - 1)}>
              Trang trước
            </button>
            <span>Trang {page}/{totalPages} · {matches.length} trận</span>
            <button className="secondary-button" type="button" disabled={page === totalPages} onClick={() => goToPage(page + 1)}>
              Trang sau
            </button>
            <form className="match-page-jump" onSubmit={handlePageJump}>
              <label htmlFor="match-history-page">Đến trang</label>
              <input
                id="match-history-page"
                type="text"
                inputMode="numeric"
                value={pageInput}
                onChange={(event) => {
                  setPageInput(event.target.value);
                  setPageError(null);
                }}
                aria-invalid={Boolean(pageError)}
              />
              <button className="secondary-button" type="submit">Mở</button>
            </form>
          </div>
          {pageError ? <p className="match-page-error">{pageError}</p> : null}
        </>
      ) : null}
    </section>
  );
}
