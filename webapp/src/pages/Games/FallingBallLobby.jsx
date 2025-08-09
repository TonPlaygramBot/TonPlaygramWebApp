import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { ensureAccountId, getTelegramId, getTelegramPhotoUrl } from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';

export default function FallingBallLobby() {
  const navigate = useNavigate();
  useTelegramBackButton();

  const [players, setPlayers] = useState(2);
  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [density, setDensity] = useState('low');
  const [mode, setMode] = useState('local');
  const [avatar, setAvatar] = useState('');

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  const startGame = async () => {
    try {
      const accountId = await ensureAccountId();
      const balRes = await getAccountBalance(accountId);
      if ((balRes.balance || 0) < stake.amount) {
        alert('Insufficient balance');
        return;
      }
      const tgId = getTelegramId();
      await addTransaction(tgId, -stake.amount, 'stake', { game: 'fallingball' });
    } catch {}

    const params = new URLSearchParams();
    params.set('players', players);
    params.set('density', density);
    params.set('mode', mode);
    if (stake.token) params.set('token', stake.token);
    if (stake.amount) params.set('amount', stake.amount);
    navigate(`/games/fallingball?${params.toString()}`);
  };

  return (
    <div className="relative p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold text-center">Falling Ball Lobby</h2>
      <div className="space-y-2">
        <h3 className="font-semibold">Lojtarë</h3>
        <div className="flex gap-2 flex-wrap">
          {[2,3,4,5,6,7,8,9,10].map((n) => (
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
      <div className="space-y-2">
        <h3 className="font-semibold">Stake</h3>
        <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Densiteti</h3>
        <div className="flex gap-2">
          {['low','med','high'].map((d) => (
            <button
              key={d}
              onClick={() => setDensity(d)}
              className={`lobby-tile capitalize ${density === d ? 'lobby-selected' : ''}`}
            >
              {d === 'med' ? 'Med' : d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Mode</h3>
        <div className="flex gap-2">
          {[
            { id: 'local', label: 'Local (AI)' },
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
      <div className="flex gap-2">
        {Array.from({ length: players }).map((_, idx) => (
          <img
            key={idx}
            src={idx === 0 ? avatar : '/assets/icons/9f14924f-e70c-4728-a9e5-ca25ef4138c8.png'}
            alt="avatar"
            className="w-10 h-10 rounded-full border"
          />
        ))}
      </div>
      <button
        onClick={startGame}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded"
      >
        START
      </button>
    </div>
  );
}

