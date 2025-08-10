import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { ensureAccountId, getTelegramId, getTelegramPhotoUrl } from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';

const DEV_ACCOUNT = import.meta.env.VITE_DEV_ACCOUNT_ID;

export default function FallingBallLobby() {
  const navigate = useNavigate();
  useTelegramBackButton();

  const [players, setPlayers] = useState(2);
  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('local');
  const [avatar, setAvatar] = useState('');

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

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
      await addTransaction(tgId, -stake.amount, 'stake', { game: 'fallingball' });
    } catch {}

    const params = new URLSearchParams();
    params.set('players', players);
    params.set('density', 'high');
    params.set('mode', mode);
    if (stake.token) params.set('token', stake.token);
    if (stake.amount) params.set('amount', stake.amount);
    if (avatar) params.set('avatar', avatar);
    if (accountId) params.set('accountId', accountId);
    if (DEV_ACCOUNT) params.set('dev', DEV_ACCOUNT);
    navigate(`/games/fallingball?${params.toString()}`);
  };

  return (
    <div className="relative p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold text-center">Falling Ball Lobby</h2>
      <div className="space-y-2">
        <h3 className="font-semibold">Players</h3>
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
      <button
        onClick={startGame}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded"
      >
        START
      </button>
    </div>
  );
}

