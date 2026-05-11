'use client';

import { useEffect, useState } from 'react';

interface RecentMatch {
  sk: string;
  score: number;
  result: string;
}

interface PlayerFormData {
  playerId: string;
  name: string;
  position: string;
  averageScore: number;
  matchCount: number;
  status: string;
  color: string;
  recentMatches: RecentMatch[];
}

interface FormExtremesResponse {
  bestForm: PlayerFormData | null;
  worstForm: PlayerFormData | null;
  totalPlayers: number;
  evaluatedPlayers: number;
}

type LoadingState = 'idle' | 'loading' | 'error' | 'success';

export function FormExtremesCard() {
  const [data, setData] = useState<FormExtremesResponse | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFormExtremes = async () => {
      setLoadingState('loading');
      setError(null);

      try {
        const response = await fetch('/api/form-extremes');
        const payload = (await response.json()) as FormExtremesResponse & { message?: string };

        if (!response.ok) {
          throw new Error(payload.message ?? 'Không thể tải dữ liệu phong độ');
        }

        setData(payload);
        setLoadingState('success');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Lỗi không xác định');
        setLoadingState('error');
      }
    };

    void loadFormExtremes();
  }, []);

  if (loadingState === 'loading') {
    return (
      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Form Analysis</p>
            <h2>Phong độ cao nhất & thấp nhất</h2>
          </div>
        </div>
        <div className="status-card neutral">
          <p style={{ textAlign: 'center' }}>Đang tải dữ liệu...</p>
        </div>
      </article>
    );
  }

  if (loadingState === 'error' || !data) {
    return (
      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Form Analysis</p>
            <h2>Phong độ cao nhất & thấp nhất</h2>
          </div>
        </div>
        <div className="status-card neutral">
          <p className="status-error">{error ?? 'Không thể tải dữ liệu'}</p>
        </div>
      </article>
    );
  }

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Form Analysis</p>
          <h2>Phong độ cao nhất & thấp nhất</h2>
        </div>
        <span className="player-pill">{data.evaluatedPlayers} cầu thủ</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Best Form Card */}
        <div className={`status-card ${data.bestForm?.color ?? 'neutral'}`}>
          <div className="status-topline">
            <strong>Phong độ cao nhất</strong>
            <span>{data.bestForm?.status ?? '—'}</span>
          </div>

          {data.bestForm ? (
            <>
              <div style={{ marginTop: '12px', marginBottom: '12px' }}>
                <strong style={{ fontSize: '18px' }}>{data.bestForm.name}</strong>
                <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0 0' }}>
                  {data.bestForm.position}
                </p>
              </div>

              <div className="score-badge">{data.bestForm.averageScore.toFixed(1)}</div>

              <div className="status-grid" style={{ marginTop: '12px' }}>
                <div>
                  <span className="metric-label">Trận</span>
                  <strong>{data.bestForm.matchCount}</strong>
                </div>
                <div>
                  <span className="metric-label">Trung bình</span>
                  <strong>{data.bestForm.averageScore.toFixed(1)}</strong>
                </div>
              </div>
            </>
          ) : (
            <p style={{ textAlign: 'center', color: '#999', marginTop: '24px' }}>
              Chưa có dữ liệu
            </p>
          )}
        </div>

        {/* Worst Form Card */}
        <div className={`status-card ${data.worstForm?.color ?? 'neutral'}`}>
          <div className="status-topline">
            <strong>Phong độ thấp nhất</strong>
            <span>{data.worstForm?.status ?? '—'}</span>
          </div>

          {data.worstForm ? (
            <>
              <div style={{ marginTop: '12px', marginBottom: '12px' }}>
                <strong style={{ fontSize: '18px' }}>{data.worstForm.name}</strong>
                <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0 0' }}>
                  {data.worstForm.position}
                </p>
              </div>

              <div className="score-badge">{data.worstForm.averageScore.toFixed(1)}</div>

              <div className="status-grid" style={{ marginTop: '12px' }}>
                <div>
                  <span className="metric-label">Trận</span>
                  <strong>{data.worstForm.matchCount}</strong>
                </div>
                <div>
                  <span className="metric-label">Trung bình</span>
                  <strong>{data.worstForm.averageScore.toFixed(1)}</strong>
                </div>
              </div>
            </>
          ) : (
            <p style={{ textAlign: 'center', color: '#999', marginTop: '24px' }}>
              Chưa có dữ liệu
            </p>
          )}
        </div>
      </div>

      <p style={{ fontSize: '12px', color: '#999', marginTop: '16px', textAlign: 'center' }}>
        Dựa trên trung bình điểm của 5 trận gần nhất ({data.evaluatedPlayers}/{data.totalPlayers} cầu thủ)
      </p>
    </article>
  );
}
