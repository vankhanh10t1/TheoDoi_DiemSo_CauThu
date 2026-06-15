'use client';

import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { fetchWithDebug } from '../lib/client-api';

export type AppTab = 'tracker' | 'match-history' | 'squad' | 'recommendations' | 'player-detail';

interface AppContextType {
  currentTab: AppTab;
  setCurrentTab: (tab: AppTab) => void;
  selectedPlayerId: string | null;
  setSelectedPlayerId: (id: string | null) => void;
  openPlayerDetail: (playerId: string) => void;
  closePlayerDetail: () => void;
  refreshTrigger: number;
  triggerRefresh: () => void;
  players: Array<{
    playerId: string;
    name: string;
    cardSeason: string;
    position: string;
  }>;
  playersError: string | null;
  loadPlayers: (options?: { force?: boolean }) => Promise<void>;
  addPlayer: (data: { name: string; cardSeason: string; position: string }) => Promise<{ ok: boolean; message?: string }>; 
  deletePlayer: (playerId: string) => Promise<{ ok: boolean; message?: string }>;
  bulkDeletePlayers: (playerIds: string[]) => Promise<{ ok: boolean; message?: string; deletedCount?: number }>;
  resetPlayerData: (playerId: string) => Promise<{ ok: boolean; message?: string }>;
}

type ApiMessagePayload = {
  message?: string;
  error?: string;
  deletedCount?: number;
};

async function readApiMessagePayload(response: Response): Promise<ApiMessagePayload> {
  const responseText = await response.text().catch(() => '');
  if (!responseText) {
    return {};
  }

  try {
    return JSON.parse(responseText) as ApiMessagePayload;
  } catch {
    return {
      message: responseText.slice(0, 500)
    };
  }
}

async function readPlayersPayload(response: Response): Promise<
  | Array<{ playerId: string; name: string; cardSeason?: string; season?: string; position: string }>
  | {
      items?: Array<{ playerId: string; name: string; cardSeason?: string; season?: string; position: string }>;
      message?: string;
      error?: string;
      requestId?: string;
      durationMs?: number;
    }
> {
  const responseText = await response.text().catch(() => '');

  if (!responseText) {
    return { message: `API trả về response rỗng (${response.status} ${response.statusText}).` };
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return {
      message: `API trả về dữ liệu không phải JSON (${response.status} ${response.statusText}).`,
      error: responseText.slice(0, 500)
    };
  }
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentTab, setCurrentTab] = useState<AppTab>('tracker');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [previousTab, setPreviousTab] = useState<AppTab | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [players, setPlayers] = useState<Array<{ playerId: string; name: string; cardSeason: string; position: string }>>([]);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const loadPlayersPromiseRef = useRef<Promise<void> | null>(null);
  const loadPlayersRequestSeqRef = useRef(0);

  async function loadPlayers(options?: { force?: boolean }) {
    if (loadPlayersPromiseRef.current && !options?.force) {
      return loadPlayersPromiseRef.current;
    }

    const requestStartedAt = Date.now();
    const requestSeq = loadPlayersRequestSeqRef.current + 1;
    loadPlayersRequestSeqRef.current = requestSeq;

    function isLatestRequest() {
      return loadPlayersRequestSeqRef.current === requestSeq;
    }

    loadPlayersPromiseRef.current = (async () => {
      try {
        console.info('[players] loading from /api/players');
        const res = await fetchWithDebug('/api/players', undefined, { caller: 'AppContext.loadPlayers' });
        const payload = await readPlayersPayload(res);

        console.info('[players] /api/players response', {
          ok: res.ok,
          status: res.status,
          elapsedMs: Date.now() - requestStartedAt,
          payloadKind: Array.isArray(payload) ? 'array' : 'object'
        });

        if (!res.ok) {
          const message = !Array.isArray(payload)
            ? payload.message ?? payload.error ?? 'Không thể tải danh sách cầu thủ.'
            : 'Không thể tải danh sách cầu thủ.';
          if (isLatestRequest()) {
            setPlayersError(message);
          }
          console.error('[players] load failed', {
            status: res.status,
            message,
            requestId: !Array.isArray(payload) ? payload.requestId : undefined,
            durationMs: !Array.isArray(payload) ? payload.durationMs : undefined
          });
          return;
        }

        const items = Array.isArray(payload) ? payload : payload.items ?? [];
        const normalizedItems = items
          .filter((item) => {
            const playerId = typeof item.playerId === 'string' ? item.playerId.trim() : '';
            const name = typeof item.name === 'string' ? item.name.trim() : '';
            return playerId.length > 0 && name.length > 0;
          })
          .map((item) => ({
            playerId: item.playerId,
            name: item.name,
            cardSeason: item.cardSeason ?? item.season ?? '',
            position: item.position ?? ''
          }));
        if (isLatestRequest()) {
          setPlayers(normalizedItems);
          setPlayersError(null);
        }
        console.info('[players] load success', {
          count: items.length,
          elapsedMs: Date.now() - requestStartedAt,
          requestId: Array.isArray(payload) ? undefined : payload.requestId
        });
      } catch (error) {
        if (isLatestRequest()) {
          setPlayersError(
            error instanceof Error
              ? `Không thể tải danh sách cầu thủ: ${error.message}`
              : 'Không thể tải danh sách cầu thủ.'
          );
        }
        console.error('[players] load exception', error);
      } finally {
        if (isLatestRequest()) {
          loadPlayersPromiseRef.current = null;
        }
      }
    })();

    return loadPlayersPromiseRef.current;
  }

  async function addPlayer(data: { name: string; cardSeason: string; position: string }) {
    try {
      const res = await fetchWithDebug('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, season: data.cardSeason, position: data.position })
      }, { caller: 'AppContext.addPlayer' });

      const payload = await res.json();
      if (!res.ok) return { ok: false, message: payload.message };
      await loadPlayers({ force: true });
      triggerRefresh();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Failed' };
    }
  }

  async function deletePlayer(playerId: string) {
    try {
      const res = await fetchWithDebug(`/api/players/${encodeURIComponent(playerId)}`, { method: 'DELETE' }, { caller: 'AppContext.deletePlayer' });
      const payload = await res.json();
      if (!res.ok) return { ok: false, message: payload.message };
      await loadPlayers({ force: true });
      triggerRefresh();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Failed' };
    }
  }

  async function bulkDeletePlayers(playerIds: string[]) {
    const uniquePlayerIds = Array.from(
      new Set(playerIds.map((playerId) => playerId.trim()).filter(Boolean))
    );

    if (uniquePlayerIds.length === 0) {
      return { ok: false, message: 'Vui lòng chọn ít nhất 1 cầu thủ để xóa.' };
    }

    try {
      const res = await fetchWithDebug('/api/players/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerIds: uniquePlayerIds })
      }, { caller: 'AppContext.bulkDeletePlayers', includeRequestBody: true });
      const payload = await readApiMessagePayload(res);

      if (!res.ok) {
        if (res.status === 404 || res.status === 405) {
          return deletePlayersSequentially(uniquePlayerIds);
        }

        return {
          ok: false,
          message:
            payload.message ??
            payload.error ??
            `Không thể xóa cầu thủ đã chọn. API trả về ${res.status} ${res.statusText}.`
        };
      }

      await loadPlayers({ force: true });
      triggerRefresh();
      return { ok: true, deletedCount: payload.deletedCount };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Failed' };
    }
  }

  async function deletePlayersSequentially(playerIds: string[]) {
    for (const playerId of playerIds) {
      const result = await deletePlayer(playerId);
      if (!result.ok) {
        return {
          ok: false,
          message: result.message ?? `Không thể xóa cầu thủ ${playerId}.`
        };
      }
    }

    await loadPlayers({ force: true });
    return { ok: true, deletedCount: playerIds.length };
  }

  async function resetPlayerData(playerId: string) {
    try {
      const res = await fetchWithDebug(`/api/players/${playerId}/reset`, { method: 'PATCH' }, { caller: 'AppContext.resetPlayerData' });
      const payload = await res.json();
      if (!res.ok) return { ok: false, message: payload.message };
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Failed' };
    }
  }

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  function openPlayerDetail(playerId: string) {
    setPreviousTab(currentTab);
    setSelectedPlayerId(playerId);
    setCurrentTab('player-detail');
  }

  function closePlayerDetail() {
    setSelectedPlayerId(null);
    setCurrentTab(previousTab ?? 'tracker');
    setPreviousTab(null);
  }

  useEffect(() => {
    void loadPlayers();
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentTab,
        setCurrentTab,
        selectedPlayerId,
        setSelectedPlayerId,
        openPlayerDetail,
        closePlayerDetail,
        refreshTrigger,
        triggerRefresh,
        players,
        playersError,
        loadPlayers,
        addPlayer,
        deletePlayer,
        bulkDeletePlayers,
        resetPlayerData
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
