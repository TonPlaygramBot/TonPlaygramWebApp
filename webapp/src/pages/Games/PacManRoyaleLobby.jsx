import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { ensureAccountId, getTelegramId, getTelegramPhotoUrl } from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';

const DEV_ACCOUNT = import.meta.env.VITE_DEV_ACCOUNT_ID;
const DEV_ACCOUNT_1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
const DEV_ACCOUNT_2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;

export default function PacManRoyaleLobby() {
  const navigate = useNavigate();
  useTelegramBackButton();

  const [stake, setStake] = useState({ token: 'TPC', amount: 500 });
  const [mode, setMode] = useState('local');
  const [aiSpeed, setAiSpeed] = useState('normal');
  const [duration, setDuration] = useState(120); // seconds
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
      await addTransaction(tgId, -stake.amount, 'stake', {
        game: 'pacman',
        accountId,
      });
    } catch {}

    const params = new URLSearchParams();
    params.set('amount', stake.amount);
    params.set('token', stake.token);
    params.set('mode', mode);
    params.set('ai', aiSpeed);
    params.set('duration', duration);
    params.set('autostart', '1');
    const initData = window.Telegram?.WebApp?.initData;
    if (avatar) params.set('avatar', avatar);
    if (tgId) params.set('tgId', tgId);
    if (accountId) params.set('accountId', accountId);
    if (DEV_ACCOUNT) params.set('dev', DEV_ACCOUNT);
    if (DEV_ACCOUNT_1) params.set('dev1', DEV_ACCOUNT_1);
    if (DEV_ACCOUNT_2) params.set('dev2', DEV_ACCOUNT_2);
    if (initData) params.set('init', encodeURIComponent(initData));
    navigate(`/games/pacmanroyale?${params.toString()}`);
  };

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
      <h2 className="text-xl font-bold text-center">Pac-Man Royale Lobby</h2>
      <div className="space-y-2">
        <h3 className="font-semibold">Stake</h3>
        <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Mode</h3>
        <div className="flex gap-2">
          {[{ id: 'local', label: 'Local (AI)' }, { id: 'online', label: 'Online' }].map(({ id, label }) => (
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
      <div className="space-y-2">
        <h3 className="font-semibold">AI Speed</h3>
        <div className="flex gap-2">
          {[{ id: 'easy', label: 'Easy' }, { id: 'normal', label: 'Normal' }, { id: 'fast', label: 'Fast' }].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setAiSpeed(id)}
              className={`lobby-tile ${aiSpeed === id ? 'lobby-selected' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Duration</h3>
        <div className="flex gap-2">
          {[
            { label: '1:30', value: 90 },
            { label: '2:00', value: 120 },
            { label: '3:00', value: 180 },
          ].map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setDuration(value)}
              className={`lobby-tile ${duration === value ? 'lobby-selected' : ''}`}
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
