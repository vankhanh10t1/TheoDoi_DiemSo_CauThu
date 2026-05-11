'use client';

import { useEffect, useState } from 'react';
import type { TransferRecommendation } from '../lib/transferEngine';
import { useAppContext } from './app-context';

export function TransferRecommendation() {
  const { refreshTrigger, setSelectedPlayerId, setCurrentTab } = useAppContext();
  const [recommendations, setRecommendations] = useState<TransferRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRecommendations() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/recommendations');
        const data = (await res.json()) as { recommendations: TransferRecommendation[] };
        setRecommendations(data.recommendations || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recommendations');
      } finally {
        setLoading(false);
      }
    }

    loadRecommendations();
  }, [refreshTrigger]);

  function handleViewDetail(playerId: string) {
    setSelectedPlayerId(playerId);
    setCurrentTab('player-detail');
  }

  const sellRecommendations = recommendations.filter((r) => r.recommendation === 'SELL');
  const monitorRecommendations = recommendations.filter((r) => r.recommendation === 'MONITOR');
  const holdRecommendations = recommendations.filter((r) => r.recommendation === 'HOLD');

  return (
    <div className="screen-panel">
      <div className="screen-header">
        <h2>Đề Xuất Chuyển Nhượng</h2>
      </div>

      {error && <p className="status-error">{error}</p>}
      {loading && <p>Đang tải đề xuất...</p>}

      {!loading && (
        <>
          {sellRecommendations.length > 0 && (
            <section className="recommendation-section sell">
              <h3 className="section-title">🚨 THANH LÝ NGAY (Phong độ kém)</h3>
              <div className="recommendations-list">
                {sellRecommendations.map((rec) => (
                  <div key={rec.playerId} className="recommendation-card red">
                    <div className="rec-header">
                      <h4>{rec.name}</h4>
                      <span className="rec-badge sell">SELL</span>
                    </div>
                    <p className="rec-reason">{rec.reason}</p>
                    <div className="rec-metrics">
                      <span>Điểm: {rec.averageScore.toFixed(1)}</span>
                      <span>Trận: {rec.matchCount}/5</span>
                    </div>
                    <button
                      className="tertiary-button"
                      onClick={() => handleViewDetail(rec.playerId)}
                    >
                      Chi Tiết
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {monitorRecommendations.length > 0 && (
            <section className="recommendation-section monitor">
              <h3 className="section-title">⚠️ THEO DÕI KỸ (Phong độ giảm)</h3>
              <div className="recommendations-list">
                {monitorRecommendations.map((rec) => (
                  <div key={rec.playerId} className="recommendation-card orange">
                    <div className="rec-header">
                      <h4>{rec.name}</h4>
                      <span className="rec-badge monitor">MONITOR</span>
                    </div>
                    <p className="rec-reason">{rec.reason}</p>
                    <div className="rec-metrics">
                      <span>Điểm: {rec.averageScore.toFixed(1)}</span>
                      <span>Trận: {rec.matchCount}/5</span>
                    </div>
                    <button
                      className="tertiary-button"
                      onClick={() => handleViewDetail(rec.playerId)}
                    >
                      Chi Tiết
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {holdRecommendations.length > 0 && (
            <section className="recommendation-section hold">
              <h3 className="section-title">✅ GIỮ CHẶT (Phong độ tốt)</h3>
              <div className="recommendations-list">
                {holdRecommendations.map((rec) => (
                  <div key={rec.playerId} className="recommendation-card green">
                    <div className="rec-header">
                      <h4>{rec.name}</h4>
                      <span className="rec-badge hold">HOLD</span>
                    </div>
                    <p className="rec-reason">{rec.reason}</p>
                    <div className="rec-metrics">
                      <span>Điểm: {rec.averageScore.toFixed(1)}</span>
                      <span>Trận: {rec.matchCount}/5</span>
                    </div>
                    <button
                      className="tertiary-button"
                      onClick={() => handleViewDetail(rec.playerId)}
                    >
                      Chi Tiết
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {recommendations.length === 0 && (
            <p style={{ marginTop: '20px' }}>Chưa có đề xuất nào. Vui lòng nhập dữ liệu trận đấu.</p>
          )}
        </>
      )}
    </div>
  );
}
