'use client';

import React, { useState, useRef } from 'react';
import type { Match } from '../lib/types';
import { fetchWithDebug } from '../lib/client-api';
import { createMatchDateTime } from '../lib/match-datetime';

interface CreateMatchFormProps {
  onMatchCreated?: (match: Match) => void;
  onCancel?: () => void;
}

export default function CreateMatchForm({ onMatchCreated, onCancel }: CreateMatchFormProps) {
  const [formData, setFormData] = useState({
    matchDate: new Date().toISOString().split('T')[0],
    opponentName: '',
    myScore: 0,
    opponentScore: 0,
    note: ''
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<'WIN' | 'DRAW' | 'LOSE' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);

  // Auto-calculate result when scores change
  React.useEffect(() => {
    if (formData.myScore > formData.opponentScore) {
      setResult('WIN');
    } else if (formData.myScore === formData.opponentScore) {
      setResult('DRAW');
    } else {
      setResult('LOSE');
    }
  }, [formData.myScore, formData.opponentScore]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'myScore' || name === 'opponentScore') {
      setFormData({ ...formData, [name]: Math.max(0, parseInt(value) || 0) });
    } else {
      setFormData({ ...formData, [name]: value });
    }
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
      // Validate required fields
      if (!formData.matchDate) {
        setMessage({ type: 'error', text: '❌ Vui lòng chọn ngày thi đấu' });
        setLoading(false);
        return;
      }

      if (formData.myScore < 0 || formData.opponentScore < 0) {
        setMessage({ type: 'error', text: '❌ Tỉ số phải là số không âm' });
        setLoading(false);
        return;
      }

      const response = await fetchWithDebug('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchDate: formData.matchDate,
          matchDateTime: createMatchDateTime(formData.matchDate),
          opponentName: formData.opponentName,
          myScore: formData.myScore,
          opponentScore: formData.opponentScore,
          note: formData.note
        })
      }, { caller: 'CreateMatchForm.handleSubmit' });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Lỗi khi tạo trận đấu');
      }

      setMessage({
        type: 'success',
        text: data.message || `✅ Tạo trận đấu thành công: ${formData.opponentName || 'N/A'} (${formData.myScore}-${formData.opponentScore})`
      });

      // Reset form
      setFormData({
        matchDate: new Date().toISOString().split('T')[0],
        opponentName: '',
        myScore: 0,
        opponentScore: 0,
        note: ''
      });

      // Callback
      if (onMatchCreated) {
        onMatchCreated(data.match);
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

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="form-group">
      <div className="form-section">
        <h3 className="form-title">Thêm trận đấu</h3>

        {/* Message display */}
        {message && (
          <div className={`inline-message ${message.type === 'success' ? 'success' : 'error'}`}>
            {message.text}
          </div>
        )}

        {/* Match Date */}
        <div className="field">
          <label htmlFor="matchDate">Ngày thi đấu</label>
          <input
            type="date"
            id="matchDate"
            name="matchDate"
            value={formData.matchDate}
            onChange={handleInputChange}
            required
            disabled={loading}
          />
        </div>

        {/* Opponent Name */}
        <div className="field">
          <label htmlFor="opponentName">Tên đối thủ</label>
          <input
            type="text"
            id="opponentName"
            name="opponentName"
            placeholder="Ví dụ: Arsenal, Chelsea, Man United"
            value={formData.opponentName}
            onChange={handleInputChange}
            disabled={loading}
          />
        </div>

        {/* Scores */}
        <div className="field-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="field">
            <label htmlFor="myScore">Tỉ số đội mình</label>
            <input
              type="number"
              id="myScore"
              name="myScore"
              min="0"
              value={formData.myScore}
              onChange={handleInputChange}
              disabled={loading}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="opponentScore">Tỉ số đối thủ</label>
            <input
              type="number"
              id="opponentScore"
              name="opponentScore"
              min="0"
              value={formData.opponentScore}
              onChange={handleInputChange}
              disabled={loading}
              required
            />
          </div>
        </div>

        {/* Result Display */}
        {result && (
          <div
            className="result-display"
            style={{
              padding: '12px 16px',
              borderRadius: '6px',
              backgroundColor:
                result === 'WIN' ? 'rgba(34, 197, 94, 0.1)' : result === 'DRAW' ? 'rgba(107, 114, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              borderLeft: `4px solid ${result === 'WIN' ? '#22c55e' : result === 'DRAW' ? '#6b7280' : '#ef4444'}`,
              fontWeight: 500,
              marginTop: '12px',
              marginBottom: '12px'
            }}
          >
            {result === 'WIN' && `✅ Kết quả: ${formData.myScore} - ${formData.opponentScore} (THẮNG)`}
            {result === 'DRAW' && `➖ Kết quả: ${formData.myScore} - ${formData.opponentScore} (HÒA)`}
            {result === 'LOSE' && `❌ Kết quả: ${formData.myScore} - ${formData.opponentScore} (THUA)`}
          </div>
        )}

        {/* Note */}
        <div className="field">
          <label htmlFor="note">Ghi chú trận đấu</label>
          <textarea
            id="note"
            name="note"
            placeholder="Ví dụ: Trận thắng đậm, hàng công đá tốt"
            value={formData.note}
            onChange={handleInputChange}
            disabled={loading}
            rows={3}
          />
        </div>

        {/* Submit and Cancel buttons */}
        <div className="button-group" style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
          <button type="submit" className="button button-primary" disabled={loading}>
            {loading ? 'Đang lưu...' : 'Lưu trận đấu'}
          </button>
          {onCancel && (
            <button type="button" className="button button-secondary" onClick={onCancel} disabled={loading}>
              Hủy
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
