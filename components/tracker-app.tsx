'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAppContext } from './app-context';
import type { PlayerStatusResponse, RatingPayload } from '../lib/types';


type SaveState = {
  message: string;
  tone: 'idle' | 'success' | 'error';
};

const INITIAL_FORM: RatingPayload = {
  playerId: '',
  score: 7,
  isStarter: true,
  result: 'Win'
};

function formatStatusTitle(status: PlayerStatusResponse['status'] | undefined): string {
  if (!status) {
    return 'Chưa có dữ liệu';
  }

  return status;
}

export function TrackerApp() {
  const { players, playersError } = useAppContext();
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.playerId ?? '');
  const [statusData, setStatusData] = useState<PlayerStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [formState, setFormState] = useState<RatingPayload>({
    ...INITIAL_FORM,
    playerId: players[0]?.playerId ?? ''
  });
  const [saveState, setSaveState] = useState<SaveState>({ message: '', tone: 'idle' });

  const selectedPlayer = useMemo(
    () => players.find((player) => player.playerId === selectedPlayerId) ?? null,
    [players, selectedPlayerId]
  );

  useEffect(() => {
    setFormState((currentState) => ({ ...currentState, playerId: selectedPlayerId }));
  }, [selectedPlayerId]);

  useEffect(() => {
    if (!selectedPlayerId && players[0]) {
      setSelectedPlayerId(players[0].playerId);
    }
  }, [players]);

  useEffect(() => {
    if (!selectedPlayerId) {
      setStatusData(null);
      setStatusError(null);
      return;
    }

    const controller = new AbortController();

    async function loadStatus() {
      setLoadingStatus(true);
      setStatusError(null);

      try {
        const response = await fetch(`/api/player-status?id=${encodeURIComponent(selectedPlayerId)}`, {
          signal: controller.signal
        });

        const errorPayload = (await response.json()) as { message?: string };

        if (!response.ok) {
          throw new Error(errorPayload.message ?? 'Không thể tải phong độ cầu thủ');
        }

        const payload = errorPayload as PlayerStatusResponse;

        setStatusData(payload);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        setStatusData(null);
        setStatusError(error instanceof Error ? error.message : 'Không thể tải phong độ cầu thủ');
      } finally {
        setLoadingStatus(false);
      }
    }

    void loadStatus();

    return () => {
      controller.abort();
    };
  }, [selectedPlayerId]);

  async function refreshPlayerStatus(playerId: string) {
    try {
      const response = await fetch(`/api/player-status?id=${encodeURIComponent(playerId)}`);
      const errorPayload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(errorPayload.message ?? 'Không thể làm mới dữ liệu');
      }

      setStatusData(errorPayload as PlayerStatusResponse);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Không thể làm mới dữ liệu');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formState.playerId) {
      setSaveState({ message: 'Hãy chọn cầu thủ trước khi lưu', tone: 'error' });
      return;
    }

    setSaveState({ message: '', tone: 'idle' });

    try {
      const response = await fetch('/api/rating', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          playerId: formState.playerId,
          score: Number(formState.score),
          isStarter: formState.isStarter,
          result: formState.result
        })
      });

      const payload = (await response.json()) as { message?: string; sk?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? 'Không thể lưu điểm trận đấu');
      }

      setSaveState({
        message: `Đã lưu thành công ${payload.sk ?? ''}`.trim(),
        tone: 'success'
      });
      await refreshPlayerStatus(formState.playerId);
    } catch (error) {
      setSaveState({
        message: error instanceof Error ? error.message : 'Không thể lưu điểm trận đấu',
        tone: 'error'
      });
    }
  }

  const statusTone =
    statusData && 'color' in statusData ? statusData.color : 'neutral';

  return (
    <div className="tracker-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">FCON Performance Tracker</p>
          <h2>Theo dõi phong độ cầu thủ thuộc đội VanKhasnh14 trong 5 trận gần nhất</h2>
          <p className="hero-copy">
            Bán độ không bao giờ có chỗ đứng trong môn thể thao vua.
          </p>
        </div>
        <div className="hero-metrics">
          <div>
            <span className="metric-label">Cầu thủ</span>
            <strong>{players.length}</strong>
          </div>
          <div>
            <span className="metric-label">Team Color</span>
            <strong>Bayern Munich</strong>
          </div>
        </div>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Entry Flow</p>
              <h2>Nhập điểm trận đấu</h2>
            </div>
          </div>

          <form className="form-stack" onSubmit={handleSubmit}>
            <label className="field">
              <span>Cầu thủ</span>
              <select
                value={selectedPlayerId}
                onChange={(event) => {
                  setSelectedPlayerId(event.target.value);
                  setFormState((currentState) => ({
                    ...currentState,
                    playerId: event.target.value
                  }));
                }}
              >
                {players.map((player) => (
                  <option key={player.playerId} value={player.playerId}>
                    {player.name} ({player.playerId})
                  </option>
                ))}
              </select>
            </label>

            <div className="field-grid">
              <label className="field">
                <span>Điểm trận</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="0.1"
                  value={formState.score}
                  onChange={(event) => {
                    setFormState((currentState) => ({
                      ...currentState,
                      score: event.target.value === '' ? 0 : Number(event.target.value)
                    }));
                  }}
                />
              </label>

              <label className="field">
                <span>Kết quả</span>
                <select
                  value={formState.result}
                  onChange={(event) => {
                    setFormState((currentState) => ({
                      ...currentState,
                      result: event.target.value as RatingPayload['result']
                    }));
                  }}
                >
                  <option value="Win">Win</option>
                  <option value="Draw">Draw</option>
                  <option value="Loss">Loss</option>
                </select>
              </label>
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={formState.isStarter}
                onChange={(event) => {
                  setFormState((currentState) => ({
                    ...currentState,
                    isStarter: event.target.checked
                  }));
                }}
              />
              <span>Đá chính</span>
            </label>

            <button className="primary-button" type="submit" disabled={!selectedPlayerId}>
              Lưu điểm
            </button>

            {saveState.message ? (
              <p className={`inline-message ${saveState.tone}`}>{saveState.message}</p>
            ) : null}
          </form>

          {playersError ? <p className="status-error" style={{ marginTop: '16px' }}>{playersError}</p> : null}
        </article>

        <article className="panel status-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Evaluation Flow</p>
              <h2>Phong độ hiện tại</h2>
            </div>
            {selectedPlayer ? <span className="player-pill">{selectedPlayer.position}</span> : null}
          </div>

          <div className={`status-card ${statusTone}`}>
            <div className="status-topline">
              <strong>{selectedPlayer?.name ?? 'Chưa chọn cầu thủ'}</strong>
              <span>{loadingStatus ? 'Đang tải...' : formatStatusTitle(statusData?.status)}</span>
            </div>

            {statusError ? <p className="status-error">{statusError}</p> : null}

            {!statusError && statusData && 'averageScore' in statusData ? (
              <>
                <div className="score-badge">{statusData.averageScore.toFixed(1)}</div>
                <div className="status-grid">
                  <div>
                    <span className="metric-label">Số trận</span>
                    <strong>{statusData.matchCount}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Hành động</span>
                    <strong>{statusData.action}</strong>
                  </div>
                </div>

                <div className="recent-list">
                  {statusData.recentMatches.map((match) => (
                    <div key={match.sk} className="recent-item">
                      <span>{match.sk}</span>
                      <strong>{match.score.toFixed(1)}</strong>
                      <em>{match.result}</em>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {!statusError && statusData && 'message' in statusData ? (
              <div className="tracking-state">
                <p>{statusData.message}</p>
                <span>Đợi đủ 5 trận gần nhất để tính X̄.</span>
              </div>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}