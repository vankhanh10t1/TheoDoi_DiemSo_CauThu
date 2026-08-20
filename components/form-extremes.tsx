'use client';

import { useEffect, useState } from 'react';
import { fetchWithDebug } from '../lib/client-api';
import { useAppContext } from './app-context';
import type { AnalysisWindow, WeightProfile } from '../lib/types';

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
  wmaScore: number;
  matchCount: number;
  status: string;
  color: string;
  trendStatus: string;
  stabilityLevel: string;
  momentumStatus: string;
  recentMatches: RecentMatch[];
  analyzedMatchCount: number;
  confidenceWarning?: string;
}

interface FormExtremesResponse {
  bestForm: PlayerFormData | null;
  worstForm: PlayerFormData | null;
  allForms: PlayerFormData[];
  totalPlayers: number;
  evaluatedPlayers: number;
  analysisWindow: AnalysisWindow;
}

type LoadingState = 'idle' | 'loading' | 'error' | 'success';

export function FormExtremesCard() {
  const { refreshTrigger } = useAppContext();
  const [data, setData] = useState<FormExtremesResponse | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [analysisWindow, setAnalysisWindow] = useState<AnalysisWindow>(5);
  const [weightProfile, setWeightProfile] = useState<WeightProfile>('WMA');
  const [filters, setFilters] = useState({ season: '', competition: '', matchType: '' });

  useEffect(() => {
    const loadFormExtremes = async () => {
      setLoadingState('loading');
      setError(null);

      try {
        const query = new URLSearchParams({ window: String(analysisWindow), weightProfile });
        Object.entries(filters).forEach(([key, value]) => { if (value.trim()) query.set(key, value.trim()); });
        const response = await fetchWithDebug(`/api/form-extremes?${query}`, undefined, { caller: 'FormExtremesCard.loadFormExtremes' });
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
  }, [refreshTrigger, analysisWindow, weightProfile, filters.season, filters.competition, filters.matchType]);

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
        <label>Cửa sổ phân tích <select value={analysisWindow} onChange={(event) => setAnalysisWindow(Number(event.target.value) as AnalysisWindow)}><option value={5}>5 trận gần nhất</option><option value={10}>10 trận gần nhất</option><option value={20}>20 trận gần nhất</option></select></label>
        <label>Profile <select value={weightProfile} onChange={(event) => setWeightProfile(event.target.value as WeightProfile)}><option value="WMA">WMA</option><option value="DECAY">Decay</option></select></label>
      </div>
      <div className="match-history-filters"><label>Mùa giải<input value={filters.season} onChange={e=>setFilters({...filters,season:e.target.value})}/></label><label>Giải đấu<input value={filters.competition} onChange={e=>setFilters({...filters,competition:e.target.value})}/></label><label>Loại trận<select value={filters.matchType} onChange={e=>setFilters({...filters,matchType:e.target.value})}><option value="">Tất cả</option><option value="FRIENDLY">Giao hữu</option><option value="LEAGUE">Giải đấu</option><option value="CUP">Cúp</option><option value="RANKED">Xếp hạng</option><option value="TRAINING">Tập luyện</option></select></label></div>

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

              <div className="score-badge">WMA {data.bestForm.wmaScore.toFixed(1)}</div>

              <div className="status-grid" style={{ marginTop: '12px' }}>
                <div>
                  <span className="metric-label">Trận</span>
                  <strong>{data.bestForm.matchCount}</strong>
                </div>
                <div>
                  <span className="metric-label">Trung bình</span>
                  <strong>{data.bestForm.averageScore.toFixed(1)}</strong>
                </div>
                <div>
                  <span className="metric-label">Trend</span>
                  <strong>{data.bestForm.trendStatus}</strong>
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

              <div className="score-badge">WMA {data.worstForm.wmaScore.toFixed(1)}</div>

              <div className="status-grid" style={{ marginTop: '12px' }}>
                <div>
                  <span className="metric-label">Trận</span>
                  <strong>{data.worstForm.matchCount}</strong>
                </div>
                <div>
                  <span className="metric-label">Trung bình</span>
                  <strong>{data.worstForm.averageScore.toFixed(1)}</strong>
                </div>
                <div>
                  <span className="metric-label">Trend</span>
                  <strong>{data.worstForm.trendStatus}</strong>
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
        Dựa trên {weightProfile === 'DECAY' ? 'Decay' : 'WMA'} của {data.analysisWindow} trận gần nhất; dùng số trận thực tế nếu lịch sử ngắn hơn ({data.evaluatedPlayers}/{data.totalPlayers} cầu thủ)
      </p>
    </article>
  );
}
