"use client";

import React from 'react';
import { getPositionColor, DETAILED_POSITIONS_BY_GROUP } from '../lib/positions';
import type { DetailedPosition } from '../lib/types';

type SquadCardProps = {
  name: string;
  cardSeason?: string;
  position?: string; // detailed position or free text
  matchCount?: number;
  riskScore?: number;
};

function getPositionGroupFromDetailed(detailed?: string): keyof typeof DETAILED_POSITIONS_BY_GROUP | undefined {
  if (!detailed || typeof detailed !== 'string') return undefined;
  const normalized = detailed.trim().toUpperCase();

  for (const key of Object.keys(DETAILED_POSITIONS_BY_GROUP) as Array<keyof typeof DETAILED_POSITIONS_BY_GROUP>) {
    if (DETAILED_POSITIONS_BY_GROUP[key].includes(normalized as DetailedPosition)) return key;
  }

  return undefined;
}

export function SquadPlayerCard({ name, cardSeason, position, matchCount, riskScore }: SquadCardProps) {
  const group = getPositionGroupFromDetailed(position) ?? 'MF';
  const color = getPositionColor(group as any);

  return (
    <article className="squad-card" style={{ borderLeft: `6px solid ${color}`, padding: '12px', borderRadius: 6, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>{cardSeason ?? ''} · {position ?? '—'}</div>
        </div>
        <div style={{ textAlign: 'right', marginLeft: 12 }}>
          {typeof matchCount === 'number' ? <div style={{ fontWeight: 700 }}>{matchCount}</div> : null}
          {typeof riskScore === 'number' ? <div style={{ fontSize: '0.75rem', color: '#999' }}>Risk {riskScore.toFixed(1)}</div> : null}
        </div>
      </div>
    </article>
  );
}

export default SquadPlayerCard;
