'use client';

import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import type { PlayerSummary } from '../lib/types';
import { fetchWithDebug } from '../lib/client-api';

export type AppTab = 'tracker' | 'squad' | 'recommendations' | 'player-detail';

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
  loadPlayers: () => Promise<void>;
  addPlayer: (data: { name: string; cardSeason: string; position: string }) => Promise<{ ok: boolean; message?: string }>; 
  deletePlayer: (playerId: string) => Promise<{ ok: boolean; message?: string }>;
  resetPlayerData: (playerId: string) => Promise<{ ok: boolean; message?: string }>;
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

  async function loadPlayers() {
    if (loadPlayersPromiseRef.current) {
      return loadPlayersPromiseRef.current;
    }

    const requestStartedAt = Date.now();

    loadPlayersPromiseRef.current = (async () => {
      try {
        console.info('[players] loading from /api/players');
        const res = await fetchWithDebug('/api/players', undefined, { caller: 'AppContext.loadPlayers' });
        const payload = (await res.json()) as
          | Array<{ playerId: string; name: string; cardSeason?: string; season?: string; position: string }>
          | {
              items?: Array<{ playerId: string; name: string; cardSeason?: string; season?: string; position: string }>;
              message?: string;
              error?: string;
              requestId?: string;
              durationMs?: number;
            };

        console.info('[players] /api/players response', {
          ok: res.ok,
          status: res.status,
          elapsedMs: Date.now() - requestStartedAt,
          payloadKind: Array.isArray(payload) ? 'array' : 'object'
        });

        if (!res.ok) {
          const message = !Array.isArray(payload)
            ? payload.error ?? payload.message ?? 'Failed to load players'
            : 'Failed to load players';
          setPlayers([]);
          setPlayersError(message);
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
        setPlayers(normalizedItems);
        setPlayersError(null);
        console.info('[players] load success', {
          count: items.length,
          elapsedMs: Date.now() - requestStartedAt,
          requestId: Array.isArray(payload) ? undefined : payload.requestId
        });
      } catch (error) {
        setPlayers([]);
        setPlayersError(error instanceof Error ? error.message : 'Failed to load players');
        console.error('[players] load exception', error);
      } finally {
        loadPlayersPromiseRef.current = null;
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
      await loadPlayers();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Failed' };
    }
  }

  async function deletePlayer(playerId: string) {
    try {
      const res = await fetchWithDebug(`/api/players/${playerId}`, { method: 'DELETE' }, { caller: 'AppContext.deletePlayer' });
      const payload = await res.json();
      if (!res.ok) return { ok: false, message: payload.message };
      await loadPlayers();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Failed' };
    }
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
