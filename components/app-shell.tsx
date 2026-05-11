'use client';

import { useState } from 'react';
import { TrackerApp } from './tracker-app';
import { SquadManagement } from './squad-management';
import { TransferRecommendation } from './transfer-recommendation';
import { PlayerDetail } from './player-detail';
import { useAppContext, type AppTab } from './app-context';

export function AppShell() {
  const { currentTab, setCurrentTab } = useAppContext();

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>⚽ FCON Performance Tracker</h1>
        <nav className="app-nav">
          <NavButton
            active={currentTab === 'tracker'}
            onClick={() => setCurrentTab('tracker')}
          >
            📊 Rating
          </NavButton>
          <NavButton
            active={currentTab === 'squad'}
            onClick={() => setCurrentTab('squad')}
          >
            👥 Đội Hình
          </NavButton>
          <NavButton
            active={currentTab === 'recommendations'}
            onClick={() => setCurrentTab('recommendations')}
          >
            🎯 Đề Xuất
          </NavButton>
        </nav>
      </header>

      <main className="app-content">
        {currentTab === 'tracker' && <TrackerApp />}
        {currentTab === 'squad' && <SquadManagement />}
        {currentTab === 'recommendations' && <TransferRecommendation />}
        {currentTab === 'player-detail' && <PlayerDetail />}
      </main>
    </div>
  );
}

function NavButton(props: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`nav-button ${props.active ? 'active' : ''}`}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
