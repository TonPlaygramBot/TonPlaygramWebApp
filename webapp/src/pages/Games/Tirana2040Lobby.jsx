import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  ensureAccountId,
  getTelegramId,
  getTelegramPhotoUrl,
  getTelegramFirstName,
} from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';

const PLAYER_COUNTS = [10, 20, 30];

export default function Tirana2040Lobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [players, setPlayers] = useState(10);
  const [avatar, setAvatar] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  const startGame = async () => {
    if (loading) return;
    setLoading(true);
    let tgId;
    let accountId;

    try {
      accountId = await ensureAccountId();
      const balRes = await getAccountBalance(accountId);
      if ((balRes.balance || 0) < stake.amount) {
        alert('Insufficient balance');
        setLoading(false);
        return;
      }
      tgId = getTelegramId();
      await addTransaction(tgId, -stake.amount, 'stake', {
        game: 'tirana2040',
        players,
        accountId,
      });
    } catch (err) {
      // failure to set up staking should not lock the UI forever
      alert('Unable to start game. Please try again.');
      setLoading(false);
      return;
    }

    const params = new URLSearchParams(search);
    const initData = window.Telegram?.WebApp?.initData;
    params.set('mode', 'ai');
    params.set('players', players.toString());
    if (stake.token) params.set('token', stake.token);
    if (stake.amount) params.set('amount', stake.amount.toString());
    if (avatar) params.set('avatar', avatar);
    if (tgId) params.set('tgId', tgId);
    if (accountId) params.set('accountId', accountId);
    const name = getTelegramFirstName();
    if (name) params.set('name', name);
    if (initData) params.set('init', encodeURIComponent(initData));

    navigate(`/games/tirana2040?${params.toString()}`);
    setLoading(false);
  };

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
      <h2 className="text-xl font-bold text-center">London 1990 Lobby</h2>
      <p className="text-sm text-subtext text-center">
        Battle through Baker Street, Marble Arch, and Oxford Street with 1990s London traffic and services still active.
      </p>
      <div className="space-y-2">
        <h3 className="font-semibold">Opponents</h3>
        <div className="flex gap-2">
          {PLAYER_COUNTS.map((count) => (
            <button
              key={count}
              onClick={() => setPlayers(count)}
              className={`lobby-tile ${players === count ? 'lobby-selected' : ''}`}
            >
              {count} AI
            </button>
          ))}
        </div>
        <p className="text-xs text-subtext">
          Matches currently run against AI squads. Human multiplayer will arrive in a future update.
        </p>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">Stake</h3>
        <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
      </div>
      <button
        onClick={startGame}
        disabled={loading}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed text-background rounded"
      >
        {loading ? 'STARTING…' : 'START'}
      </button>
    </div>
  );
}
