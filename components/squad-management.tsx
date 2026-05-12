'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PlayerSummary } from '../lib/types';
import { useAppContext } from './app-context';

type AddPlayerForm = {
  name: string;
  cardSeason: string;
  position: string;
};

type EditPlayerForm = {
  name: string;
  cardSeason: string;
  position: string;
};

const POSITION_OPTIONS = [
  { value: 'ST', label: 'ST (Tiền Đạo)' },
  { value: 'CF', label: 'CF (Trung Phối Công)' },
  { value: 'LW', label: 'LW (Tiền Đạo Cánh Trái)' },
  { value: 'RW', label: 'RW (Tiền Đạo Cánh Phải)' },
  { value: 'CAM', label: 'CAM (Hộ Công)' },
  { value: 'CM', label: 'CM (Tiền Vệ Trung Tâm)' },
  { value: 'CDM', label: 'CDM (Tiền Vệ Phòng Ngự)' },
  { value: 'LM', label: 'LM (Tiền Vệ Cánh Trái)' },
  { value: 'RM', label: 'RM (Tiền Vệ Cánh Phải)' },
  { value: 'LWB', label: 'LWB (Hậu Vệ/wing trái)' },
  { value: 'RWB', label: 'RWB (Hậu Vệ/wing phải)' },
  { value: 'CB', label: 'CB (Hậu Vệ Trung Tâm)' },
  { value: 'LB', label: 'LB (Hậu Vệ Trái)' },
  { value: 'RB', label: 'RB (Hậu Vệ Phải)' },
  { value: 'GK', label: 'GK (Thủ Môn)' }
];

export function SquadManagement() {
  const {
    players,
    playersError,
    loadPlayers,
    addPlayer,
    deletePlayer,
    setSelectedPlayerId,
    setCurrentTab
  } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<AddPlayerForm>({
    name: '',
    cardSeason: '',
    position: ''
  });
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(
    null
  );
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<EditPlayerForm>({
    name: '',
    cardSeason: '',
    position: ''
  });
  const [searchText, setSearchText] = useState('');

  const filteredPlayers = useMemo(() => {
    const normalizedQuery = searchText.trim().toLowerCase();
    if (!normalizedQuery) {
      return players;
    }

    return players.filter((player) => player.name.trim().toLowerCase().includes(normalizedQuery));
  }, [players, searchText]);

  useEffect(() => {
    setLoading(true);
    loadPlayers()
      .finally(() => setLoading(false));
  }, []);

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault();
    setSaveMessage(null);

    try {
      const result = await addPlayer({ name: formData.name, cardSeason: formData.cardSeason, position: formData.position });
      if (!result.ok) throw new Error(result.message ?? 'Failed');

      setSaveMessage({ text: 'Cầu thủ đã thêm thành công', type: 'success' });
      setFormData({ name: '', cardSeason: '', position: '' });
      setShowForm(false);
    } catch (err) {
      setSaveMessage({
        text: err instanceof Error ? err.message : 'Không thể thêm cầu thủ',
        type: 'error'
      });
    }
  }

  async function handleDeletePlayer(playerId: string) {
    if (!confirm(`Xóa cầu thủ ${playerId}? Tất cả dữ liệu trận đấu sẽ bị xóa.`)) {
      return;
    }

    try {
      const result = await deletePlayer(playerId);
      if (!result.ok) throw new Error(result.message ?? 'Failed');

      setSaveMessage({ text: 'Cầu thủ đã xóa thành công', type: 'success' });
    } catch (err) {
      setSaveMessage({
        text: err instanceof Error ? err.message : 'Không thể xóa cầu thủ',
        type: 'error'
      });
    }
  }

  function handleStartEdit(player: PlayerSummary) {
    setEditingPlayerId(player.playerId);
    setEditFormData({
      name: player.name,
      cardSeason: player.cardSeason,
      position: player.position
    });
    setSaveMessage(null);
  }

  function handleCancelEdit() {
    setEditingPlayerId(null);
    setEditFormData({ name: '', cardSeason: '', position: '' });
  }

  async function handleUpdatePlayer(playerId: string, e: React.FormEvent) {
    e.preventDefault();
    setSaveMessage(null);

    try {
      const response = await fetch(`/api/players/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editFormData.name,
          cardSeason: editFormData.cardSeason,
          position: editFormData.position
        })
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? 'Failed to update player');
      }

      setSaveMessage({ text: 'Cầu thủ đã được cập nhật thành công', type: 'success' });
      setEditingPlayerId(null);
      setEditFormData({ name: '', cardSeason: '', position: '' });
      await loadPlayers();
    } catch (err) {
      setSaveMessage({
        text: err instanceof Error ? err.message : 'Không thể cập nhật cầu thủ',
        type: 'error'
      });
    }
  }

  function handleViewDetail(playerId: string) {
    setSelectedPlayerId(playerId);
    setCurrentTab('player-detail');
  }

  return (
    <div className="screen-panel">
      <div className="screen-header">
        <h2>Quản Lý Đội Hình</h2>
        <div className="squad-header-controls">
          <label className="squad-search-field" aria-label="Tìm kiếm cầu thủ theo tên">
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Tìm cầu thủ theo tên..."
            />
          </label>
          <button className="primary-button" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Hủy' : '+ Thêm Cầu Thủ'}
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className={`inline-message ${saveMessage.type}`}>{saveMessage.text}</div>
      )}

      {showForm && (
        <form className="form-stack" onSubmit={handleAddPlayer} style={{ marginBottom: '20px' }}>
          <label className="field">
            <span>Tên Cầu Thủ</span>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="VD: C. Ronaldo"
              required
            />
          </label>

          <label className="field">
            <span>Mùa Thẻ</span>
            <input
              type="text"
              value={formData.cardSeason}
              onChange={(e) => setFormData({ ...formData, cardSeason: e.target.value })}
              placeholder="VD: 21CU"
              required
            />
          </label>

          <label className="field">
            <span>Vị Trí</span>
            <select
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              required
            >
              <option value="">-- Chọn vị trí --</option>
              {POSITION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button className="primary-button" type="submit">
            Thêm Cầu Thủ
          </button>
        </form>
      )}

      {loading && <p>Đang tải...</p>}
      {playersError && <p className="status-error">{playersError}</p>}

      {!loading && players.length === 0 && <p>Chưa có cầu thủ nào. Hãy thêm cầu thủ mới.</p>}

      {!loading && players.length > 0 && filteredPlayers.length === 0 && (
        <p>Không tìm thấy cầu thủ phù hợp với từ khóa đã nhập.</p>
      )}

      {!loading && filteredPlayers.length > 0 && (
        <div className="players-grid">
          {filteredPlayers.map((player) => (
            <div key={player.playerId} className="player-card">
              <div className="player-card-header">
                <h3>{player.name}</h3>
                <span className="position-badge">{player.position}</span>
              </div>
              <p className="player-id">ID: {player.playerId}</p>
              <p className="player-season">Mùa: {player.cardSeason}</p>
              <div className="player-card-actions">
                <button
                  className="secondary-button"
                  onClick={() => handleViewDetail(player.playerId)}
                >
                  Chi Tiết
                </button>
                <button
                  className="secondary-button"
                  onClick={() => handleStartEdit(player)}
                >
                  Cập Nhật
                </button>
                <button
                  className="danger-button"
                  onClick={() => handleDeletePlayer(player.playerId)}
                >
                  Xóa
                </button>
              </div>

              {editingPlayerId === player.playerId && (
                <form
                  className="form-stack"
                  onSubmit={(event) => void handleUpdatePlayer(player.playerId, event)}
                  style={{ marginTop: '16px' }}
                >
                  <label className="field">
                    <span>Tên Cầu Thủ</span>
                    <input
                      type="text"
                      value={editFormData.name}
                      onChange={(event) =>
                        setEditFormData({ ...editFormData, name: event.target.value })
                      }
                      required
                    />
                  </label>

                  <label className="field">
                    <span>Mùa Thẻ</span>
                    <input
                      type="text"
                      value={editFormData.cardSeason}
                      onChange={(event) =>
                        setEditFormData({ ...editFormData, cardSeason: event.target.value })
                      }
                      required
                    />
                  </label>

                  <label className="field">
                    <span>Vị Trí</span>
                    <select
                      value={editFormData.position}
                      onChange={(event) =>
                        setEditFormData({ ...editFormData, position: event.target.value })
                      }
                      required
                    >
                      <option value="">-- Chọn vị trí --</option>
                      {POSITION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="player-card-actions">
                    <button className="primary-button" type="submit">
                      Lưu Cập Nhật
                    </button>
                    <button className="secondary-button" type="button" onClick={handleCancelEdit}>
                      Hủy
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
