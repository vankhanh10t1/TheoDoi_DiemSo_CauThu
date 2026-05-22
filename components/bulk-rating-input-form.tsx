'use client';

import React, { useState, useEffect } from 'react';
import type { Match, PlayerSummary, DetailedPosition, PositionGroup } from '../lib/types';
import { useAppContext } from './app-context';

interface BulkRatingInputFormProps {
  match: Match;
  onRatingsSaved?: (result: { created: number; updated: number }) => void;
  onCancel?: () => void;
}

interface PlayerRating {
  playerId: string;
  name: string;
  cardSeason: string;
  position: string;
  positionGroup: PositionGroup;
  participating: boolean;
  rating: number;
  yellowCards: number;
  redCards: number;
  fouls: number;
  goals?: number;
  assists?: number;
  note?: string;
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function hasAtMostOneDecimalPlace(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;
}

const POSITION_GROUP_ORDER: PositionGroup[] = ['GK', 'DF', 'MF', 'FW'];

const POSITION_GROUP_BY_DETAIL: Record<string, PositionGroup> = {
  GK: 'GK',
  CB: 'DF',
  LB: 'DF',
  LWB: 'DF',
  RB: 'DF',
  RWB: 'DF',
  CDM: 'MF',
  CM: 'MF',
  CAM: 'MF',
  LM: 'MF',
  RM: 'MF',
  ST: 'FW',
  CF: 'FW',
  LW: 'FW',
  RW: 'FW'
};

function normalizePlayerPosition(position: unknown): string {
  if (typeof position !== 'string') return '';
  return position.trim().toUpperCase();
}

function getPlayerPositionGroup(position: unknown): PositionGroup {
  return POSITION_GROUP_BY_DETAIL[normalizePlayerPosition(position)] ?? 'FW';
}

function sortPlayersForEntry(playersToSort: PlayerSummary[] | undefined): PlayerSummary[] {
  const list = Array.isArray(playersToSort) ? playersToSort : [];
  return [...list].sort((left, right) => {
    const leftGroup = getPlayerPositionGroup(left.position ?? '');
    const rightGroup = getPlayerPositionGroup(right.position ?? '');
    const leftGroupIndex = POSITION_GROUP_ORDER.indexOf(leftGroup);
    const rightGroupIndex = POSITION_GROUP_ORDER.indexOf(rightGroup);

    if (leftGroupIndex !== rightGroupIndex) {
      return leftGroupIndex - rightGroupIndex;
    }

    const leftName = getPlayerDisplayName(left);
    const rightName = getPlayerDisplayName(right);
    return leftName.localeCompare(rightName, 'vi');
  });
}

function getPlayerDisplayName(p: PlayerSummary | any): string {
  // fallback chain: name, playerName, fullName, playerId, 'Unknown Player'
  if (!p) return 'Unknown Player';
  const name = (p.name ?? p.playerName ?? p.fullName ?? p.displayName ?? p.playerId) as string | undefined;
  if (typeof name === 'string' && name.trim() !== '') return name.trim();
  return 'Unknown Player';
}

export default function BulkRatingInputForm({ match, onRatingsSaved, onCancel }: BulkRatingInputFormProps) {
  const { players, playersError, loadPlayers } = useAppContext();
  const [ratings, setRatings] = useState<PlayerRating[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const submittingRef = React.useRef(false);

  useEffect(() => {
    const safePlayers = Array.isArray(players) ? players : [];

    if (safePlayers.length === 0 && !playersError) {
      void loadPlayers();
      return;
    }

    const playerList = sortPlayersForEntry(safePlayers);
    setRatings(
      playerList.map((p) => ({
        playerId: p.playerId,
        name: p.name ?? '',
        cardSeason: p.cardSeason ?? '',
        position: p.position ?? '',
        positionGroup: getPlayerPositionGroup(p.position ?? ''),
        participating: false,
        rating: 5,
        yellowCards: 0,
        redCards: 0,
        fouls: 0,
        goals: 0,
        assists: 0,
        note: ''
      }))
    );
  }, [players, playersError]);

  

  const handleParticipationChange = (playerId: string, participating: boolean) => {
    setRatings((prev) =>
      prev.map((r) => (r.playerId === playerId ? { ...r, participating } : r))
    );
  };

  const handleRatingChange = (playerId: string, field: keyof PlayerRating, value: string | number | boolean) => {
    setRatings((prev) =>
      prev.map((r) => {
        if (r.playerId === playerId) {
          if (field === 'rating') {
            const n = Number(value);
            const parsed = Number.isFinite(n) ? n : 1;
            return { ...r, [field]: Math.max(1, Math.min(10, roundToOneDecimal(parsed))) };
          } else if (field === 'goals' || field === 'assists' || field === 'yellowCards' || field === 'redCards' || field === 'fouls') {
            const n = parseInt(String(value), 10);
            const parsed = Number.isInteger(n) ? n : 0;
            return { ...r, [field]: Math.max(0, parsed) };
          } else {
            return { ...r, [field]: value as any };
          }
        }
        return r;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setMessage(null);
    setLoading(true);

    try {
      // Get participating players
      const participatingRatings = ratings.filter((r) => r.participating);

      if (participatingRatings.length === 0) {
        setMessage({ type: 'error', text: '⚠️ Vui lòng chọn ít nhất một cầu thủ tham gia' });
        setLoading(false);
        return;
      }

      // Validate all ratings
      for (const rating of participatingRatings) {
        if (!Number.isFinite(rating.rating) || rating.rating < 1 || rating.rating > 10) {
          setMessage({
            type: 'error',
            text: `❌ Điểm ${rating.name} phải từ 1 đến 10`
          });
          setLoading(false);
          return;
        }

        if (!hasAtMostOneDecimalPlace(rating.rating)) {
          setMessage({
            type: 'error',
            text: `❌ Điểm ${rating.name} chỉ được có tối đa 1 chữ số sau dấu phẩy`
          });
          setLoading(false);
          return;
        }
      }


      // Prepare payload
      const payload = {
        ratings: participatingRatings.map((r) => ({
          playerId: r.playerId,
          rating: r.rating,
          position: r.position as DetailedPosition,
          yellowCards: r.yellowCards,
          redCards: r.redCards,
          fouls: r.fouls,
          goals: r.goals,
          assists: r.assists,
          note: r.note
        }))
      };

      console.info('[client] POST /api/matches/%s/ratings payload', match.id, payload);

      const response = await fetch(`/api/matches/${match.id}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      console.info('[client] /api/matches/%s/ratings response', match.id, { ok: response.ok, status: response.status, body: data });

      if (!response.ok) {
        throw new Error(data.error || 'Lỗi khi lưu đánh giá');
      }

      setMessage({
        type: 'success',
        text: data.message || `✅ Lưu ${data.created + data.updated} đánh giá thành công`
      });

      // Callback
      if (onRatingsSaved) {
        onRatingsSaved({ created: data.created, updated: data.updated });
      }

        // Reset message after 2 seconds
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: `❌ ${error instanceof Error ? error.message : 'Lỗi không xác định'}`
      });
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const participatingCount = ratings.filter((r) => r.participating).length;

  if (players.length === 0 && !playersError) {
    return <div className="inline-message">Đang tải danh sách cầu thủ...</div>;
  }

  if (playersError) {
    return <div className="inline-message error">❌ {playersError}</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="form-group">
      <div className="form-section">
        <h3 className="form-title">Nhập điểm cầu thủ</h3>

        {/* Match Info */}
        <div
          className="match-info"
          style={{
            padding: '16px',
            backgroundColor: 'rgba(59, 130, 246, 0.05)',
            borderRadius: '6px',
            marginBottom: '20px',
            borderLeft: '4px solid #3b82f6'
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
            <div>
              <strong>Ngày:</strong> {new Date(match.matchDate).toLocaleDateString('vi-VN')}
            </div>
            <div>
              <strong>Đối thủ:</strong> {match.opponentName || 'N/A'}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <strong>Tỉ số:</strong> {match.myScore} - {match.opponentScore}
            </div>
            <div>
              <strong>Kết quả:</strong>{' '}
              {match.result === 'WIN' && '✅ THẮNG'}
              {match.result === 'DRAW' && '➖ HÒA'}
              {match.result === 'LOSE' && '❌ THUA'}
            </div>
            <div>
              <strong>Số cầu thủ:</strong> {participatingCount}/{ratings.length}
            </div>
          </div>
        </div>

        {/* Message display */}
        {message && (
          <div className={`inline-message ${message.type === 'success' ? 'success' : 'error'}`}>
            {message.text}
          </div>
        )}

        {/* Ratings Table */}
        <div
          style={{
            overflowX: 'auto',
            marginBottom: '20px',
            borderRadius: '6px',
            border: '1px solid #e5e7eb'
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: '#fff'
            }}
          >
            <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Tham gia</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Cầu thủ</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Mùa thẻ</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Vị trí</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600 }}>Điểm</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600 }}>🟨</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600 }}>🟥</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600 }}>⚠️</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600 }}>Bàn</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600 }}>Kiến tạo</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {ratings.map((rating, idx) => (
                <tr
                  key={rating.playerId}
                  style={{
                    borderBottom: '1px solid #e5e7eb',
                    backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb'
                  }}
                >
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={rating.participating}
                      onChange={(e) => handleParticipationChange(rating.playerId, e.target.checked)}
                      disabled={loading}
                    />
                  </td>
                  <td style={{ padding: '12px' }}>{rating.name}</td>
                  <td style={{ padding: '12px' }}>{rating.cardSeason}</td>
                  <td style={{ padding: '12px' }}>{rating.position}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <input
                      type="number"
                      min="1"
                      max="10"
                              step="0.1"
                      value={rating.rating}
                      onChange={(e) => handleRatingChange(rating.playerId, 'rating', e.target.value)}
                      disabled={!rating.participating || loading}
                              inputMode="decimal"
                      style={{
                        width: '50px',
                        padding: '6px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        textAlign: 'center'
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={rating.yellowCards}
                      onChange={(e) => handleRatingChange(rating.playerId, 'yellowCards', e.target.value)}
                      disabled={!rating.participating || loading}
                      style={{ width: '50px', padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', textAlign: 'center' }}
                    />
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={rating.redCards}
                      onChange={(e) => handleRatingChange(rating.playerId, 'redCards', e.target.value)}
                      disabled={!rating.participating || loading}
                      style={{ width: '50px', padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', textAlign: 'center' }}
                    />
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={rating.fouls}
                      onChange={(e) => handleRatingChange(rating.playerId, 'fouls', e.target.value)}
                      disabled={!rating.participating || loading}
                      style={{ width: '50px', padding: '6px', border: '1px solid #d1d5db', borderRadius: '4px', textAlign: 'center' }}
                    />
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <input
                      type="number"
                      min="0"
                      value={rating.goals}
                      onChange={(e) => handleRatingChange(rating.playerId, 'goals', e.target.value)}
                      disabled={!rating.participating || loading}
                      style={{
                        width: '50px',
                        padding: '6px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        textAlign: 'center'
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <input
                      type="number"
                      min="0"
                      value={rating.assists}
                      onChange={(e) => handleRatingChange(rating.playerId, 'assists', e.target.value)}
                      disabled={!rating.participating || loading}
                      style={{
                        width: '50px',
                        padding: '6px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        textAlign: 'center'
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px' }}>
                    <input
                      type="text"
                      placeholder="Ghi chú"
                      value={rating.note}
                      onChange={(e) => handleRatingChange(rating.playerId, 'note', e.target.value)}
                      disabled={!rating.participating || loading}
                      style={{
                        width: '100%',
                        minWidth: '120px',
                        padding: '6px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px'
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Submit and Cancel buttons */}
        <div className="button-group" style={{ display: 'flex', gap: '12px' }}>
          <button
            type="submit"
            className="primary-button"
            disabled={loading}
            aria-disabled={loading}
          >
            {loading ? 'Đang lưu...' : 'Lưu điểm trận đấu'}
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              // reset participating and stats to defaults
              setRatings((prev) => prev.map((r) => ({ ...r, participating: false, rating: 5, yellowCards: 0, redCards: 0, fouls: 0, goals: 0, assists: 0, note: '' })));
              setMessage(null);
            }}
            disabled={loading}
          >
            Reset
          </button>

          {onCancel && (
            <button type="button" className="tertiary-button" onClick={onCancel} disabled={loading}>
              Hủy
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
