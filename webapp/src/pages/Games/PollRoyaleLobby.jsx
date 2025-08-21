import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { ensureAccountId, getTelegramId, getTelegramPhotoUrl, getTelegramFirstName } from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';

export default function PollRoyaleLobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('ai');
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
        game: 'pollroyale',
        players: 2,
        accountId,
      });
    } catch {}

    const params = new URLSearchParams();
    params.set('mode', mode);
    const initData = window.Telegram?.WebApp?.initData;
    if (stake.token) params.set('token', stake.token);
    if (stake.amount) params.set('amount', stake.amount);
    if (avatar) params.set('avatar', avatar);
    if (tgId) params.set('tgId', tgId);
    if (accountId) params.set('accountId', accountId);
    const name = getTelegramFirstName();
    if (name) params.set('name', name);
    const devAcc = import.meta.env.VITE_DEV_ACCOUNT_ID;
    const devAcc1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
    const devAcc2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;
    if (devAcc) params.set('dev', devAcc);
    if (devAcc1) params.set('dev1', devAcc1);
    if (devAcc2) params.set('dev2', devAcc2);
    if (initData) params.set('init', encodeURIComponent(initData));
    navigate(`/games/pollroyale?${params.toString()}`);
  };

  const winnerParam = new URLSearchParams(search).get('winner');

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
      {winnerParam && (
        <div className="text-center font-semibold">
          {winnerParam === '1' ? 'You won!' : 'CPU won!'}
        </div>
      )}
      <h2 className="text-xl font-bold text-center">8 Poll Royale Lobby</h2>
      <div className="space-y-2">
        <h3 className="font-semibold">Mode</h3>
        <div className="flex gap-2">
          {[
            { id: 'ai', label: 'Vs AI' },
            { id: 'online', label: '1v1 Online' }
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
      <div className="space-y-2">
        <h3 className="font-semibold">Stake</h3>
        <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
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
