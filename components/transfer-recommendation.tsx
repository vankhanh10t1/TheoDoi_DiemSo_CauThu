'use client';

import { useEffect, useState } from 'react';
import type { TransferRecommendation } from '../lib/recommendationService';
import { useAppContext } from './app-context';

function getTrendEmoji(trend: string): string {
  switch (trend) {
    case 'UP':
      return '📈';
    case 'DOWN':
      return '⬇️';
    case 'STABLE':
    default:
      return '→';
  }
}

function getTrendLabel(trend: string): string {
  switch (trend) {
    case 'UP':
      return 'TĂNG';
    case 'DOWN':
      return 'GIẢM';
    case 'STABLE':
    default:
      return 'ỔN ĐỊNH';
  }
}

function getRiskTone(riskLevel: string): string {
  switch (riskLevel) {
    case 'HIGH':
      return 'red';
    case 'MEDIUM':
      return 'orange';
    case 'LOW':
    default:
      return 'green';
  }
}

export function TransferRecommendation() {
  const { refreshTrigger, openPlayerDetail } = useAppContext();
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
    (async () => {
      try {
        const res = await fetch(`/api/players/${encodeURIComponent(playerId)}`);
        if (!res.ok) {
          setError('Cầu thủ không tồn tại trong hệ thống');
          return;
        }

        openPlayerDetail(playerId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể kiểm tra cầu thủ');
      }
    })();
  }

  return (
    <div className="screen-panel">
      <div className="screen-header">
        <h2>Theo dõi phong độ cầu thủ &amp; đề xuất chuyển nhượng</h2>
      </div>

      {error && <p className="status-error">{error}</p>}
      {loading && <p>Đang tải danh sách cầu thủ...</p>}

      {!loading && (
        <>
          {recommendations.length > 0 ? (
            <section className="recommendation-section">
              <h3 className="section-title">Danh sách cầu thủ đã có rating</h3>
              <div className="recommendations-list">
                {recommendations.map((rec) => (
                  <div
                    key={rec.playerId}
                    className={`recommendation-card ${getRiskTone(rec.riskLevel)}`}
                  >
                    <div className="rec-header">
                      <h4>{rec.name}</h4>
                      <div className="rec-badges">
                        <span className={`rec-badge risk risk-${rec.riskLevel.toLowerCase()}`}>
                          Risk {rec.riskLevel}
                        </span>
                      </div>
                    </div>
                    <div className="rec-metrics">
                      <span>Mùa thẻ: {rec.cardSeason || 'Chưa có dữ liệu'}</span>
                      <span>Vị trí: {rec.position || 'Chưa có dữ liệu'}</span>
                      <span>Trận: {rec.matchCount}</span>
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
          ) : null}

          {recommendations.length === 0 && (
            <p style={{ marginTop: '20px' }}>Chưa có cầu thủ nào có dữ liệu rating.</p>
          )}
        </>
      )}
    </div>
  );
}
