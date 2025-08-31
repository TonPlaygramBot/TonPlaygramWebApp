import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { ensureAccountId, getTelegramId } from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';

export default function FreeKickLobby() {
  const navigate = useNavigate();
  useTelegramBackButton();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('ai');
  const [players, setPlayers] = useState(2);
  const [duration, setDuration] = useState(60);

  const startGame = async () => {
    let tgId;
    let accountId;
    try {
      accountId = await ensureAccountId();
      const balRes = await getAccountBalance(accountId);
      if ((balRes.balance || 0) < stake.amount) {
        alert('Insufficient balance');
        return;
      }
      tgId = getTelegramId();
      await addTransaction(tgId, -stake.amount, 'stake', {
        game: 'freekick',
        players: mode === 'ai' ? 1 : players,
        accountId,
      });
    } catch {}

    const params = new URLSearchParams();
    params.set('mode', mode);
    if (mode === 'online') {
      params.set('players', players);
    }
    if (stake.token) params.set('token', stake.token);
    if (stake.amount) params.set('amount', stake.amount);
    if (duration) params.set('duration', duration);
    if (tgId) params.set('tgId', tgId);
    if (accountId) params.set('accountId', accountId);
    navigate(`/games/freekick?${params.toString()}`);
  };

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
      <h2 className="text-xl font-bold text-center">Free Kick Lobby</h2>
      <div className="space-y-2">
        <h3 className="font-semibold">Mode</h3>
        <div className="flex gap-2">
          {[
            { id: 'ai', label: 'Vs AI' },
            { id: 'online', label: 'Online' }
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`lobby-tile ${mode === id ? 'lobby-selected' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {mode === 'online' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Players</h3>
          <div className="flex gap-2">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setPlayers(n)}
                className={`lobby-tile ${players === n ? 'lobby-selected' : ''}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <h3 className="font-semibold">Duration</h3>
        <div className="flex gap-2">
          {[60, 120, 180].map((t) => (
            <button
              key={t}
              onClick={() => setDuration(t)}
              className={`lobby-tile ${duration === t ? 'lobby-selected' : ''}`}
            >
              {t === 60 ? '1m' : t === 120 ? '2m' : '3m'}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Stake</h3>
        <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
      </div>
      <button
        onClick={startGame}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded"
      >
        Start Game
      </button>
    </div>
  );
}
