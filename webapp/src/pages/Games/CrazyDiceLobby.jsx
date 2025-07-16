import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pingOnline, getOnlineCount } from '../../utils/api.js';
import { getPlayerId } from '../../utils/telegram.js';
import { REGIONS } from '../../utils/conflictMatchmaking.js';
import RoomSelector from '../../components/RoomSelector.jsx';
import TableSelector from '../../components/TableSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function CrazyDiceLobby() {
  const navigate = useNavigate();
  useTelegramBackButton(() => navigate('/games', { replace: true }));

  const TABLES = [
    { id: 'single', label: 'Single Player vs AI', capacity: 1 },
    { id: '2p', label: 'Table 2p', capacity: 2 },
    { id: '3p', label: 'Table 3p', capacity: 3 },
    { id: '4p', label: 'Table 4p', capacity: 4 },
  ];

  const [table, setTable] = useState(TABLES[0]);
  const [rolls, setRolls] = useState(1);
  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [aiCount, setAiCount] = useState(1);
  const [region, setRegion] = useState('');
  const [online, setOnline] = useState(0);

  useEffect(() => {
    const playerId = getPlayerId();
    function ping() {
      pingOnline(playerId).catch(() => {});
      getOnlineCount()
        .then((d) => setOnline(d.count))
        .catch(() => {});
    }
    ping();
    const id = setInterval(ping, 30000);
    return () => clearInterval(id);
  }, []);

  const startGame = () => {
    const params = new URLSearchParams();
    if (table.id === 'single') {
      params.set('ai', aiCount);
      params.set('players', aiCount + 1);
    } else {
      params.set('players', table.capacity);
    }
    params.set('rolls', rolls);
    if (stake.token) params.set('token', stake.token);
    if (stake.amount) params.set('amount', stake.amount);
    if (region) params.set('region', region);
    navigate(`/games/crazydice?${params.toString()}`);
  };

  const disabled = !stake.token || !stake.amount || !table;

  return (
    <div className="relative p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold text-center">Crazy Dice Lobby</h2>
      <p className="text-center text-sm">Online users: {online}</p>
      <div className="space-y-2">
        <h3 className="font-semibold">Select Table</h3>
        <TableSelector tables={TABLES} selected={table} onSelect={setTable} />
      </div>
      {table?.id === 'single' && (
        <div className="space-y-2">
          <h3 className="font-semibold">How many AI opponents?</h3>
          <div className="flex gap-2">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => setAiCount(n)}
                className={`lobby-tile ${aiCount === n ? 'lobby-selected' : ''}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <h3 className="font-semibold">Rolls</h3>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRolls(n)}
              className={`lobby-tile ${rolls === n ? 'lobby-selected' : ''}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Conflict Region</h3>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="lobby-tile w-full text-black"
        >
          <option value="">Auto (Local)</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Select Stake</h3>
        <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
        <p className="text-center text-subtext text-sm">
          TON and USDT staking coming soon. Smart contract under
          construction.
        </p>
      </div>
      <button
        onClick={startGame}
        disabled={disabled}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded disabled:opacity-50"
      >
        Start Game
      </button>
    </div>
  );
}
