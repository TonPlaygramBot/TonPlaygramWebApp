import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  applySerializedSnookerState,
  applySnookerEvents,
  createSnookerFrame,
  serializeSnookerState
} from '../../../src/rules/SnookerClubRules.ts';
import { resolveSnookerTableSize } from '../../config/snookerTables.js';
import { getTelegramId, getTelegramUsername } from '../../utils/telegram.js';

function SnookerFrameCard({ frame }) {
  const ballsOn = (frame.ballOn || []).join(', ') || 'Open';
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow space-y-2">
      <div className="flex justify-between text-sm text-subtext">
        <span>Active: {frame.activePlayer}</span>
        <span>Phase: {frame.phase}</span>
      </div>
      <div className="flex justify-between text-sm text-subtext">
        <span>Reds left: {frame.redsRemaining}</span>
        <span>Ball on: {ballsOn}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg border border-border p-2">
          <p className="font-semibold">{frame.players.A.name}</p>
          <p>Score: {frame.players.A.score}</p>
          <p>Break: {frame.activePlayer === 'A' ? frame.currentBreak || 0 : 0}</p>
        </div>
        <div className="rounded-lg border border-border p-2">
          <p className="font-semibold">{frame.players.B.name}</p>
          <p>Score: {frame.players.B.score}</p>
          <p>Break: {frame.activePlayer === 'B' ? frame.currentBreak || 0 : 0}</p>
        </div>
      </div>
      {frame.foul && (
        <div className="rounded-lg border border-red-500 text-red-500 p-2 text-sm">
          Foul: {frame.foul.reason} ({frame.foul.points} pts)
        </div>
      )}
      {frame.frameOver && frame.winner && (
        <div className="rounded-lg border border-primary text-primary p-2 text-sm">
          Frame winner: {frame.winner}
        </div>
      )}
    </div>
  );
}

export default function SnookerClub() {
  const location = useLocation();
  const navigate = useNavigate();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const tableSize = resolveSnookerTableSize(params.get('tableSize'));
  const playerName = useMemo(() => {
    const name = params.get('name');
    return name || getTelegramUsername() || getTelegramId() || 'Player';
  }, [params]);

  const [frame, setFrame] = useState(() => createSnookerFrame(playerName, 'Opponent'));
  const [history, setHistory] = useState(() => [serializeSnookerState(frame)]);

  useEffect(() => {
    const restored = params.get('state');
    if (restored) {
      try {
        const snapshot = JSON.parse(decodeURIComponent(restored));
        setFrame(applySerializedSnookerState(snapshot));
      } catch {}
    }
  }, [params]);

  const recordShot = (events) => {
    const updated = applySnookerEvents(events, { mode: params.get('mode') || 'ai' }, { ...frame });
    const serialized = serializeSnookerState(updated);
    setFrame({ ...updated });
    setHistory((h) => [...h, serialized].slice(-8));
  };

  const restart = () => {
    const fresh = createSnookerFrame(playerName, 'Opponent');
    setFrame(fresh);
    setHistory([serializeSnookerState(fresh)]);
    navigate(`/games/snookerclub?tableSize=${tableSize.id}`);
  };

  return (
    <div className="p-4 space-y-4 text-text">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Snooker Club</h1>
          <p className="text-sm text-subtext">
            Championship cloth and chrome from Pool Royale, dedicated snooker markings, and AI-ready match flow.
          </p>
        </div>
        <div className="rounded-lg border border-border px-3 py-2 text-sm text-subtext">
          <p>Table: {tableSize.label}</p>
          <p>Ball diameter: {tableSize.ballDiameterMm} mm</p>
        </div>
      </div>

      <SnookerFrameCard frame={frame} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          type="button"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-primary"
          onClick={() => recordShot([{ type: 'POTTED', ball: 'RED', pocket: 'TM' }])}
        >
          Pot Red
        </button>
        <button
          type="button"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-primary"
          onClick={() =>
            recordShot([
              { type: 'HIT', firstContact: 'YELLOW' },
              { type: 'POTTED', ball: 'YELLOW', pocket: 'TR' }
            ])
          }
        >
          Pot Colour
        </button>
        <button
          type="button"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-primary"
          onClick={() => recordShot([{ type: 'FOUL', reason: 'Miss', ball: 'BLACK' }])}
        >
          Register Foul
        </button>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 shadow space-y-2 text-sm text-subtext">
        <p>
          Shots and fouls are tracked independently from Pool Royale so we can train the snooker-specific AI without coupling
          code paths.
        </p>
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-2 text-sm hover:border-primary text-text"
          onClick={restart}
        >
          Restart Frame
        </button>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-surface p-4 text-xs text-subtext space-y-1">
        <p className="font-semibold text-text">History</p>
        {history.map((snap, idx) => (
          <div key={idx} className="flex gap-2">
            <span className="text-primary">#{idx + 1}</span>
            <span>Active: {snap.activePlayer}</span>
            <span>Score A/B: {snap.players.A.score}/{snap.players.B.score}</span>
            <span>Phase: {snap.phase}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
