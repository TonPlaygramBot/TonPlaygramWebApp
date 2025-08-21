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

export default function BubbleSmashRoyaleLobby() {
  const navigate = useNavigate();
  useTelegramBackButton();

  const [players, setPlayers] = useState(2);
  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('local');
  const [duration, setDuration] = useState(1);
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
        game: 'bubblesmash',
        players,
        accountId,
      });
    } catch {}

    const params = new URLSearchParams();
    params.set('players', players);
    params.set('mode', mode);
    params.set('duration', duration * 60);
    const initData = window.Telegram?.WebApp?.initData;
    if (stake.token) params.set('token', stake.token);
    if (stake.amount) params.set('amount', stake.amount);
    if (avatar) params.set('avatar', avatar);
    if (tgId) params.set('tgId', tgId);
    if (accountId) params.set('accountId', accountId);
    if (DEV_ACCOUNT) params.set('dev', DEV_ACCOUNT);
    if (DEV_ACCOUNT_1) params.set('dev1', DEV_ACCOUNT_1);
    if (DEV_ACCOUNT_2) params.set('dev2', DEV_ACCOUNT_2);
    if (initData) params.set('init', encodeURIComponent(initData));
    navigate(`/games/bubblesmashroyale?${params.toString()}`);
  };

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
      <h2 className="text-xl font-bold text-center">Bubble Smash Royale Lobby</h2>
      <div className="space-y-2">
        <h3 className="font-semibold">Players</h3>
        <div className="flex gap-2 flex-wrap">
          {[2,3,4].map((n) => (
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
            { id: 'online', label: 'Online', disabled: true }
          ].map(({ id, label, disabled }) => (
            <div key={id} className="relative">
              <button
                onClick={() => !disabled && setMode(id)}
                className={`lobby-tile ${mode === id ? 'lobby-selected' : ''} ${
                  disabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={disabled}
              >
                {label}
              </button>
              {disabled && (
                <span className="absolute inset-0 flex items-center justify-center text-xs bg-black bg-opacity-50 text-background">
                  Under development
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Duration (minutes)</h3>
        <div className="flex gap-2">
          {[1,3,5].map((m) => (
            <button
              key={m}
              onClick={() => setDuration(m)}
              className={`lobby-tile ${duration === m ? 'lobby-selected' : ''}`}
            >
              {m}
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
