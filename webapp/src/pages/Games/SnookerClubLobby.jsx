import { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import TableSelector from '../../components/TableSelector.jsx';
import { TABLE_SIZE_LIST, resolveSnookerTable } from '../../config/snookerClubTables.js';

const BALL_SET = Object.freeze([
  '15 Reds',
  'Yellow',
  'Green',
  'Brown',
  'Blue',
  'Pink',
  'Black',
  'White Cue Ball'
]);

export default function SnookerClubLobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const params = new URLSearchParams(search);
  const initialTable = useMemo(
    () => resolveSnookerTable(params.get('tableSize')),
    [params]
  );

  const [playType, setPlayType] = useState('regular');
  const [mode, setMode] = useState('ai');
  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [players, setPlayers] = useState(8);
  const [rulesEnabled, setRulesEnabled] = useState(true);
  const [tableSize, setTableSize] = useState(initialTable);

  const tables = useMemo(
    () =>
      TABLE_SIZE_LIST.map((entry) => ({
        ...entry,
        label: `${entry.label} Snooker Table`,
        capacity: entry.id === '12ft' ? 4 : 2
      })),
    []
  );

  const startGame = () => {
    const qs = new URLSearchParams();
    qs.set('tableSize', tableSize.id);
    qs.set('type', playType);
    qs.set('mode', mode);
    if (playType !== 'training') {
      if (stake.token) qs.set('token', stake.token);
      if (stake.amount) qs.set('amount', stake.amount);
    }
    if (playType === 'tournament') qs.set('players', players);
    if (playType === 'training') qs.set('rules', rulesEnabled ? 'on' : 'off');
    navigate(`/games/snookerclub?${qs.toString()}`);
  };

  return (
    <div className="space-y-6 text-text">
      <header className="space-y-2 text-center">
        <p className="text-sm text-subtext uppercase tracking-wide">Premium Arena</p>
        <h1 className="text-2xl font-bold">Snooker Club</h1>
        <p className="text-sm text-subtext">
          Independent snooker build using Pool Royale cloth, rails and chrome, with official markings and full ball set.
        </p>
      </header>

      <section className="bg-surface border border-border rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Play Type</h2>
          <div className="flex gap-2">
            {['regular', 'training', 'tournament'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setPlayType(type)}
                className={`px-3 py-2 rounded-full text-xs font-semibold border ${
                  playType === type ? 'bg-primary text-black border-primary' : 'border-border'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Opponents</h3>
          <div className="flex gap-2">
            {['online', 'ai'].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`px-3 py-2 rounded-full text-xs font-semibold border ${
                  mode === value ? 'bg-primary text-black border-primary' : 'border-border'
                }`}
              >
                {value === 'ai' ? 'VS AI' : 'Online'}
              </button>
            ))}
          </div>
        </div>
        {playType === 'tournament' && (
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-semibold">Players</label>
            <input
              type="number"
              min={4}
              max={32}
              value={players}
              onChange={(e) => setPlayers(Number(e.target.value) || 4)}
              className="input w-24 text-right"
            />
          </div>
        )}
        {playType === 'training' ? (
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={rulesEnabled}
              onChange={(e) => setRulesEnabled(e.target.checked)}
            />
            Keep official snooker rules on during training
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-subtext mb-1">Stake Token</label>
              <input
                type="text"
                value={stake.token}
                onChange={(e) => setStake((s) => ({ ...s, token: e.target.value }))}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-subtext mb-1">Stake Amount</label>
              <input
                type="number"
                min={0}
                value={stake.amount}
                onChange={(e) => setStake((s) => ({ ...s, amount: Number(e.target.value) || 0 }))}
                className="input w-full"
              />
            </div>
          </div>
        )}
      </section>

      <section className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Table Size</h2>
          <p className="text-xs text-subtext">Independent snooker build, not shared with pool.</p>
        </div>
        <TableSelector
          tables={tables}
          selected={tableSize}
          onSelect={(t) => setTableSize(resolveSnookerTable(t.id))}
        />
        <p className="text-xs text-subtext">
          All tables reuse the Pool Royale cloth, rails, chrome plates and arena lighting for a matched look while preserving official snooker baulk lines.
        </p>
      </section>

      <section className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-semibold">Official Set</h2>
        <p className="text-xs text-subtext">
          We load the certified snooker markings (D, baulk line, pyramid spot layout) and full 21-ball set as used in the retired Snooker 3D build.
        </p>
        <ul className="grid grid-cols-2 gap-2 text-sm">
          {BALL_SET.map((ball) => (
            <li key={ball} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary inline-block" />
              {ball}
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        onClick={startGame}
        className="w-full rounded-full bg-primary py-3 text-black font-semibold shadow-lg"
      >
        Enter Snooker Club
      </button>
    </div>
  );
}
