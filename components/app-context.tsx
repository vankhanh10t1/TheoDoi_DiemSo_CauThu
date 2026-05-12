'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { PlayerSummary } from '../lib/types';

export type AppTab = 'tracker' | 'squad' | 'recommendations' | 'player-detail';

interface AppContextType {
  currentTab: AppTab;
  setCurrentTab: (tab: AppTab) => void;
  selectedPlayerId: string | null;
  setSelectedPlayerId: (id: string | null) => void;
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
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [players, setPlayers] = useState<Array<{ playerId: string; name: string; cardSeason: string; position: string }>>([]);
  const [playersError, setPlayersError] = useState<string | null>(null);

  async function loadPlayers() {
    const requestStartedAt = Date.now();

    try {
      console.info('[players] loading from /api/players');
      const res = await fetch('/api/players');
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
      // Ensure all items have the correct field names (cardSeason, not season)
      const normalizedItems = items.map(item => ({
        playerId: item.playerId,
        name: item.name,
        cardSeason: item.cardSeason ?? item.season ?? '',
        position: item.position
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
    }
  }

  async function addPlayer(data: { name: string; cardSeason: string; position: string }) {
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, season: data.cardSeason, position: data.position })
      });

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
      const res = await fetch(`/api/players/${playerId}`, { method: 'DELETE' });
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
      const res = await fetch(`/api/players/${playerId}/reset`, { method: 'PATCH' });
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
