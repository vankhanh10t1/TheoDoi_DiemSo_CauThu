'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PlayerSummary } from '../lib/types';
import { useAppContext } from './app-context';
import { SquadPlayerCard } from './SquadPlayerCard';
import { POSITION_GROUPS, groupPlayersByPosition } from '../lib/positions';
import { fetchWithDebug } from '../lib/client-api';

type SearchField = 'name' | 'cardSeason' | 'position';

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
    openPlayerDetail
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
  const [searchField, setSearchField] = useState<SearchField>('name');
  const [pendingDeletePlayer, setPendingDeletePlayer] = useState<PlayerSummary | null>(null);
  const [isDeletingPlayer, setIsDeletingPlayer] = useState(false);

  function normalizeSearchValue(value?: string) {
    return (value ?? 'N/A').trim().toLowerCase();
  }

  function getPlayerSearchValue(player: PlayerSummary, field: SearchField) {
    if (field === 'name') return player.name;
    if (field === 'cardSeason') return player.cardSeason ?? 'N/A';
    return player.position ?? 'N/A';
  }

  function getPlayerDisplayValue(value?: string) {
    const normalized = value?.trim();
    return normalized ? normalized : 'N/A';
  }

  function getPositionLabel(position?: string) {
    const normalizedPosition = position?.trim().toUpperCase();
    if (!normalizedPosition) {
      return 'N/A';
    }

    const match = POSITION_OPTIONS.find((option) => option.value === normalizedPosition);
    return match ? match.label : normalizedPosition;
  }

  const filteredPlayers = useMemo(() => {
    const normalizedQuery = searchText.trim().toLowerCase();
    if (!normalizedQuery) {
      return players;
    }

    return players.filter((player) =>
      normalizeSearchValue(getPlayerSearchValue(player, searchField)).includes(normalizedQuery)
    );
  }, [players, searchField, searchText]);

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
    const playerToDelete = pendingDeletePlayer;
    if (!playerToDelete || isDeletingPlayer || playerToDelete.playerId !== playerId) {
      return;
    }

    setIsDeletingPlayer(true);

    try {
      const result = await deletePlayer(playerId);
      if (!result.ok) throw new Error(result.message ?? 'Failed');

      setSaveMessage({ text: 'Cầu thủ đã xóa thành công', type: 'success' });
      setPendingDeletePlayer(null);
    } catch (err) {
      setSaveMessage({
        text: err instanceof Error ? err.message : 'Không thể xóa cầu thủ',
        type: 'error'
      });
    } finally {
      setIsDeletingPlayer(false);
    }
  }

  function openDeleteConfirm(player: PlayerSummary) {
    setPendingDeletePlayer(player);
    setSaveMessage(null);
  }

  function closeDeleteConfirm() {
    if (isDeletingPlayer) {
      return;
    }

    setPendingDeletePlayer(null);
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
      const response = await fetchWithDebug(`/api/players/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editFormData.name,
          cardSeason: editFormData.cardSeason,
          position: editFormData.position
        })
      }, { caller: 'SquadManagement.handleUpdatePlayer' });

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
    (async () => {
      try {
        const res = await fetchWithDebug(`/api/players/${encodeURIComponent(playerId)}`, undefined, { caller: 'SquadManagement.handleViewDetail' });
        if (!res.ok) {
          alert('Cầu thủ không tồn tại trong hệ thống');
          return;
        }

        openPlayerDetail(playerId);
      } catch (err) {
        alert('Không thể kiểm tra thông tin cầu thủ');
      }
    })();
  }

  return (
    <div className="screen-panel">
      <div className="screen-header">
        <h2>Quản Lý Đội Hình</h2>
        <div className="squad-header-controls">
          <label className="squad-search-field" aria-label="Tìm kiếm cầu thủ theo tiêu chí">
            <select
              value={searchField}
              onChange={(event) => setSearchField(event.target.value as SearchField)}
              aria-label="Chọn tiêu chí tìm kiếm"
            >
              <option value="name">Tên</option>
              <option value="cardSeason">Mùa thẻ</option>
              <option value="position">Vị trí</option>
            </select>
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={
                searchField === 'name'
                  ? 'Tìm theo tên cầu thủ...'
                  : searchField === 'cardSeason'
                    ? 'Tìm theo mùa thẻ...'
                    : 'Tìm theo vị trí...'
              }
              aria-label="Nhập từ khóa tìm kiếm"
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
        <div className="players-groups">
          {(() => {
            const grouped = groupPlayersByPosition(filteredPlayers as PlayerSummary[]);

            return POSITION_GROUPS.map((grp) => {
              const playersInGroup = grouped[grp] || [];
              if (playersInGroup.length === 0) return null; // hide empty groups per spec option

              return (
                <section key={grp} className="player-group" style={{ marginBottom: 20 }}>
                  <div className="group-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 style={{ margin: 0 }}>{grp}</h3>
                    <div style={{ fontSize: 12, color: '#666' }}>{playersInGroup.length} cầu thủ</div>
                  </div>

                  <div className="players-grid">
                    {playersInGroup.map((player) => (
                      <div key={player.playerId} className="flex flex-col gap-3 pb-4">
                        <SquadPlayerCard
                          name={player.name}
                          cardSeason={player.cardSeason}
                          position={player.position}
                        />

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
                            onClick={() => openDeleteConfirm(player)}
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
                </section>
              );
            });
          })()}
        </div>
      )}

      {pendingDeletePlayer && (
        <div className="modal-backdrop" role="presentation" onClick={closeDeleteConfirm}>
          <div
            className="confirmation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-player-title"
            aria-describedby="delete-player-description"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirmation-modal-header">
              <div>
                <p className="confirmation-modal-eyebrow">Xác nhận xóa</p>
                <h3 id="delete-player-title">Xóa cầu thủ này?</h3>
              </div>
              <button
                type="button"
                className="tertiary-button"
                onClick={closeDeleteConfirm}
                disabled={isDeletingPlayer}
                aria-label="Đóng hộp xác nhận xóa"
              >
                ×
              </button>
            </div>

            <p id="delete-player-description" className="confirmation-modal-copy">
              Tất cả dữ liệu trận đấu liên quan sẽ bị xóa.
            </p>

            <div className="confirmation-modal-summary">
              <div>
                <span>Tên</span>
                <strong>{getPlayerDisplayValue(pendingDeletePlayer.name)}</strong>
              </div>
              <div>
                <span>Mùa thẻ</span>
                <strong>{getPlayerDisplayValue(pendingDeletePlayer.cardSeason)}</strong>
              </div>
              <div>
                <span>Vị trí</span>
                <strong>{getPositionLabel(pendingDeletePlayer.position)}</strong>
              </div>
            </div>

            {saveMessage?.type === 'error' ? (
              <div className="inline-message error" style={{ marginTop: 0 }}>
                {saveMessage.text}
              </div>
            ) : null}

            <div className="confirmation-modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={closeDeleteConfirm}
                disabled={isDeletingPlayer}
              >
                Hủy
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => void handleDeletePlayer(pendingDeletePlayer.playerId)}
                disabled={isDeletingPlayer}
              >
                {isDeletingPlayer ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
