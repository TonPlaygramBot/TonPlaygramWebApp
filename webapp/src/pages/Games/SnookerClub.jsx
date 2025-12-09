import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import PoolRoyale from './PoolRoyale.jsx';
import {
  resolveTableSize,
  TABLE_SIZE_OPTIONS
} from '../../config/snookerClubTables.js';

export default function SnookerClub() {
  const { search } = useLocation();
  const navigate = useNavigate();
  useTelegramBackButton();

  const params = useMemo(() => new URLSearchParams(search), [search]);
  const tableSize = resolveTableSize(params.get('tableSize'));
  const playType = params.get('type') || 'regular';
  const mode = params.get('mode') || (playType === 'training' ? 'solo' : 'ai');
  const rulesEnabled = params.get('rules') !== 'off';

  const metaLines = useMemo(() => {
    const lines = [];
    lines.push(`Table: ${tableSize.label}`);
    lines.push(playType === 'training' ? 'Training table' : `Mode: ${mode}`);
    lines.push(rulesEnabled ? 'Full snooker rules on' : 'Free practice');
    return lines;
  }, [mode, playType, rulesEnabled, tableSize.label]);

  const switchTable = (id) => {
    const next = new URLSearchParams(params.toString());
    next.set('tableSize', resolveTableSize(id).id);
    navigate(`/games/snookerclub?${next.toString()}`);
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-surface to-black text-text">
      <div className="sticky top-0 z-10 bg-surface/80 backdrop-blur border-b border-border">
        <div className="p-4 space-y-2">
          <h1 className="text-xl font-bold">Snooker Club</h1>
          <p className="text-sm text-subtext">
            Dedicated snooker build powered by the Pool Royale cloth, chrome, and wood stacks, with
            the classic markings and ball set restored.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {metaLines.map((line) => (
              <span key={line} className="rounded-full bg-primary/10 px-3 py-1 text-primary">
                {line}
              </span>
            ))}
          </div>
          <div className="flex gap-2 text-xs flex-wrap">
            {Object.values(TABLE_SIZE_OPTIONS).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => switchTable(id)}
                className={`lobby-tile ${tableSize.id === id ? 'lobby-selected' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="rounded-xl border border-border bg-surface/80 p-4">
          <h2 className="text-lg font-semibold mb-2">Arena</h2>
          <p className="text-sm text-subtext">
            The snooker arena mirrors the Pool Royale venue but runs on its own scene graph, so
            lighting, crowd, and rails stay isolated from pool matches.
          </p>
        </div>

        <div className="rounded-xl border border-border overflow-hidden shadow-lg">
          <PoolRoyale />
        </div>
      </div>
    </div>
  );
}
