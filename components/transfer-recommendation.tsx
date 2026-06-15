'use client';

import { useEffect, useMemo, useState } from 'react';
import type { TransferRecommendation } from '../lib/recommendationService';
import { useAppContext } from './app-context';
import { fetchWithDebug } from '../lib/client-api';

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

function getRiskSectionLabel(riskLevel: string): string {
  switch (riskLevel) {
    case 'HIGH':
      return 'HIGH RISK';
    case 'MEDIUM':
      return 'MEDIUM RISK';
    case 'LOW':
    default:
      return 'LOW RISK';
  }
}

function getRiskSectionTone(riskLevel: string): string {
  switch (riskLevel) {
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    case 'LOW':
    default:
      return 'low';
  }
}

function getRiskOrder(riskLevel: string): number {
  switch (riskLevel) {
    case 'HIGH':
      return 0;
    case 'MEDIUM':
      return 1;
    case 'LOW':
    default:
      return 2;
  }
}

type RiskSection = {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  items: TransferRecommendation[];
};

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
        const res = await fetchWithDebug('/api/recommendations', undefined, { caller: 'TransferRecommendation.loadRecommendations' });
        const data = (await res.json()) as {
          recommendations?: TransferRecommendation[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? 'Không thể tải danh sách đề xuất');
        }
        setRecommendations(data.recommendations || []);
      } catch (err) {
        setRecommendations([]);
        setError(err instanceof Error ? err.message : 'Không thể tải danh sách đề xuất');
      } finally {
        setLoading(false);
      }
    }

    loadRecommendations();
  }, [refreshTrigger]);

  const groupedRecommendations = useMemo<RiskSection[]>(() => {
    const sorted = [...recommendations].sort((a, b) => {
      const riskOrderDiff = getRiskOrder(a.riskLevel) - getRiskOrder(b.riskLevel);

      if (riskOrderDiff !== 0) {
        return riskOrderDiff;
      }

      return b.riskScore - a.riskScore;
    });

    const grouped = sorted.reduce<Record<'LOW' | 'MEDIUM' | 'HIGH', TransferRecommendation[]>>(
      (accumulator, item) => {
        accumulator[item.riskLevel].push(item);
        return accumulator;
      },
      { LOW: [], MEDIUM: [], HIGH: [] }
    );

    return [
      { riskLevel: 'HIGH' as const, items: grouped.HIGH },
      { riskLevel: 'MEDIUM' as const, items: grouped.MEDIUM },
      { riskLevel: 'LOW' as const, items: grouped.LOW }
    ].filter((section) => section.items.length > 0);
  }, [recommendations]);

  function handleViewDetail(playerId: string) {
    (async () => {
      try {
        const res = await fetchWithDebug(`/api/players/${encodeURIComponent(playerId)}`, undefined, { caller: 'TransferRecommendation.handleViewDetail' });
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
          {groupedRecommendations.length > 0 ? (
            <section className="recommendation-section">
              <h3 className="section-title">Danh sách cầu thủ đã có rating</h3>
              <div className="risk-groups">
                {groupedRecommendations.map((section) => (
                  <article
                    key={section.riskLevel}
                    className={`risk-group risk-group-${getRiskSectionTone(section.riskLevel)}`}
                  >
                    <div className="risk-group-header">
                      <div>
                        <h4>{getRiskSectionLabel(section.riskLevel)}</h4>
                        <p>{section.items.length} cầu thủ</p>
                      </div>
                      <span className={`rec-badge risk risk-${section.riskLevel.toLowerCase()}`}>
                        {section.riskLevel}
                      </span>
                    </div>

                    <div className="recommendations-list">
                      {section.items.map((rec) => (
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
                                <span className={`rec-badge trend trend-${(rec.trend || 'STABLE').toLowerCase()}`}>
                                  {getTrendEmoji(rec.trend)} {getTrendLabel(rec.trend)}
                                </span>
                            </div>
                          </div>
                          <div className="rec-metrics compact">
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
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {!error && recommendations.length === 0 && (
            <p style={{ marginTop: '20px' }}>Chưa có cầu thủ nào có dữ liệu rating.</p>
          )}
        </>
      )}
    </div>
  );
}
