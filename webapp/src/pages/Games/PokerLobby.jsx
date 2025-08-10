import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pingOnline, getOnlineCount } from '../../utils/api.js';
import { ensureAccountId } from '../../utils/telegram.js';
import RoomSelector from '../../components/RoomSelector.jsx';
import TableSelector from '../../components/TableSelector.jsx';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function PokerLobby() {
  const navigate = useNavigate();
  useTelegramBackButton();

  const TABLES = [
    { id: 'single', label: 'Single Player vs AI', capacity: 1 },
    { id: '2p', label: 'Table 2p', capacity: 2 },
    { id: '3p', label: 'Table 3p', capacity: 3 },
    { id: '4p', label: 'Table 4p', capacity: 4 },
    { id: '5p', label: 'Table 5p', capacity: 5 },
  ];

  const [table, setTable] = useState(TABLES[0]);
  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [aiCount, setAiCount] = useState(1);
  const [aiType, setAiType] = useState('');
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [flags, setFlags] = useState([]);
  const [online, setOnline] = useState(0);

  useEffect(() => {
    let id;
    let cancelled = false;
    ensureAccountId()
      .then((accountId) => {
        if (cancelled || !accountId) return;
        function ping() {
          pingOnline(accountId).catch(() => {});
          getOnlineCount()
            .then((d) => setOnline(d.count))
            .catch(() => {});
        }
        ping();
        id = setInterval(ping, 30000);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (id) clearInterval(id);
    };
  }, []);

  const selectAiType = (t) => {
    setAiType(t);
    if (t === 'flags') setShowFlagPicker(true);
    if (t !== 'flags') setFlags([]);
  };

  const startGame = (flagOverride = flags) => {
    const params = new URLSearchParams();
    if (table.id === 'single') {
      params.set('ai', aiCount);
      params.set('players', aiCount + 1);
      params.set('avatars', aiType);
      if (aiType === 'flags' && flagOverride.length) {
        params.set('flags', flagOverride.join(','));
      }
    } else {
      params.set('players', table.capacity);
    }
    if (stake.token) params.set('token', stake.token);
    if (stake.amount) params.set('amount', stake.amount);
    navigate(`/games/poker?${params.toString()}`);
  };

  const disabled =
    !stake.token ||
    !stake.amount ||
    !table ||
    (table.id === 'single' && !aiType) ||
    (table.id === 'single' && aiType === 'flags' && flags.length !== aiCount);

  return (
    <div className="relative p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold text-center">Poker Lobby</h2>
      <p className="text-center text-sm">Online users: {online}</p>
      <div className="space-y-2">
        <h3 className="font-semibold">Select Table</h3>
        <TableSelector tables={TABLES} selected={table} onSelect={setTable} />
      </div>
      {table?.id === 'single' && (
        <div className="space-y-2">
          <h3 className="font-semibold">How many AI opponents?</h3>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setAiCount(n)}
                className={`lobby-tile ${aiCount === n ? 'lobby-selected' : ''}`}
              >
                {n}
              </button>
            ))}
          </div>
          <h3 className="font-semibold mt-2">AI Avatars</h3>
          <div className="flex gap-2">
            {['flags'].map((t) => (
              <button
                key={t}
                onClick={() => selectAiType(t)}
                className={`lobby-tile ${aiType === t ? 'lobby-selected' : ''}`}
              >
                Flags
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <h3 className="font-semibold">Select Stake</h3>
        <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
      </div>
      <button
        onClick={startGame}
        disabled={disabled}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded disabled:opacity-50"
      >
        Start Game
      </button>
      <FlagPickerModal
        open={showFlagPicker}
        count={aiCount}
        selected={flags}
        onSave={setFlags}
        onClose={() => setShowFlagPicker(false)}
        onComplete={(sel) => startGame(sel)}
      />
    </div>
  );
}
