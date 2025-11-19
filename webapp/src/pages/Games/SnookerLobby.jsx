import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  ensureAccountId,
  getTelegramId,
  getTelegramPhotoUrl,
  getTelegramFirstName
} from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { isBalanceInsufficient } from '../../utils/balance.js';

const FEATURED_TABLES = Object.freeze([
  {
    id: 'royalWalnut',
    label: 'Royal Walnut',
    description: 'Warm walnut rails with brushed brass trim inspired by the Pool Royale flagship table.'
  },
  {
    id: 'royalObsidian',
    label: 'Royal Obsidian',
    description: 'Midnight graphite shell with neon edge lighting for a modern arena look.'
  }
]);

export default function SnookerLobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [playType, setPlayType] = useState('regular');
  const [mode, setMode] = useState('ai');
  const [avatar, setAvatar] = useState('');
  const [tableFinish, setTableFinish] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const requested = params.get('finish');
        if (requested && FEATURED_TABLES.some((option) => option.id === requested)) {
          return requested;
        }
      } catch {}
      try {
        const stored = window.localStorage.getItem('snookerTableFinish');
        if (stored && FEATURED_TABLES.some((option) => option.id === stored)) {
          return stored;
        }
      } catch {}
    }
    return FEATURED_TABLES[0].id;
  });

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('snookerTableFinish', tableFinish);
      } catch {}
    }
  }, [tableFinish]);

  const startGame = async () => {
    let tgId;
    let accountId;
    if (playType !== 'training') {
      try {
        accountId = await ensureAccountId();
        const balanceResponse = await getAccountBalance(accountId);
        if (isBalanceInsufficient(balanceResponse, stake.amount)) {
          alert('Insufficient balance');
          return;
        }
        tgId = getTelegramId();
        await addTransaction(tgId, -stake.amount, 'stake', {
          game: 'snooker',
          players: 2,
          accountId
        });
      } catch {}
    } else {
      try {
        tgId = getTelegramId();
        accountId = await ensureAccountId();
      } catch {}
    }

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('snookerTableFinish', tableFinish);
      } catch {}
    }

    const params = new URLSearchParams();
    params.set('type', playType);
    params.set('finish', tableFinish);
    if (playType !== 'training') {
      params.set('mode', mode);
      if (stake.token) params.set('token', stake.token);
      if (stake.amount) params.set('amount', stake.amount);
    }
    const initData = window.Telegram?.WebApp?.initData;
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

    navigate(`/games/snooker?${params.toString()}`);
  };

  const searchParams = new URLSearchParams(search);
  const winnerParam = searchParams.get('winner');

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
      {winnerParam && (
        <div className="text-center font-semibold">
          {winnerParam === '1' ? 'You won!' : 'CPU won!'}
        </div>
      )}
      <h2 className="text-xl font-bold text-center">3D Snooker Lobby</h2>
      <p className="text-center text-sm text-subtext">
        Challenge the AI in the brand-new Royal tables inspired by Pool Royale.
      </p>
      <div className="space-y-2">
        <h3 className="font-semibold">Type</h3>
        <div className="flex gap-2">
          {[
            { id: 'regular', label: 'Regular' },
            { id: 'training', label: 'Training' }
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setPlayType(id)}
              className={`lobby-tile ${playType === id ? 'lobby-selected' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {playType !== 'training' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Mode</h3>
          <div className="flex gap-2">
            {[
              { id: 'ai', label: 'Vs AI' },
              { id: 'online', label: '1v1 Online', disabled: true }
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
      )}
      <div className="space-y-2">
        <h3 className="font-semibold">Table</h3>
        <div className="space-y-2">
          {FEATURED_TABLES.map(({ id, label, description }) => (
            <button
              key={id}
              onClick={() => setTableFinish(id)}
              className={`w-full text-left lobby-tile ${
                tableFinish === id ? 'lobby-selected' : ''
              }`}
            >
              <div className="font-semibold">{label}</div>
              <div className="text-xs text-subtext leading-snug">{description}</div>
            </button>
          ))}
        </div>
      </div>
      {playType !== 'training' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Stake</h3>
          <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
        </div>
      )}
      <button
        onClick={startGame}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded"
      >
        START
      </button>
    </div>
  );
}
