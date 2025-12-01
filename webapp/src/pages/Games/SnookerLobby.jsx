import { useEffect, useMemo, useState } from 'react';
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

const AVAILABLE_TABLE_FINISHES = Object.freeze([
  'rusticSplit',
  'charredTimber',
  'plankStudio',
  'weatheredGrey',
  'jetBlackCarbon'
]);

export default function SnookerLobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const initialPlayType = (() => {
    const params = new URLSearchParams(search);
    const requested = params.get('type');
    return requested === 'training' ? 'training' : 'regular';
  })();
  const [playType, setPlayType] = useState(initialPlayType);
  const [mode, setMode] = useState('ai');
  const [avatar, setAvatar] = useState('');
  const tableFinish = useMemo(() => {
    const params = new URLSearchParams(search);
    const requested = params.get('finish');
    if (requested && AVAILABLE_TABLE_FINISHES.includes(requested)) {
      return requested;
    }
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem('snookerTableFinish');
        if (stored && AVAILABLE_TABLE_FINISHES.includes(stored)) {
          return stored;
        }
      } catch {}
    }
    return AVAILABLE_TABLE_FINISHES[0];
  }, [search]);

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
      if (playType !== 'training') {
        const balanceResponse = await getAccountBalance(accountId);
        if ((balanceResponse.balance || 0) < stake.amount) {
          alert('Insufficient balance');
          return;
        }
        tgId = getTelegramId();
        await addTransaction(tgId, -stake.amount, 'stake', {
          game: 'snooker',
          players: 2,
          accountId
        });
      } else {
        tgId = getTelegramId();
      }
    } catch {}

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('snookerTableFinish', tableFinish);
      } catch {}
    }

    const params = new URLSearchParams();
    params.set('type', playType);
    params.set('finish', tableFinish);
    params.set('mode', mode);
    if (playType !== 'training') {
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
        Play on the original Pool Royale-spec snooker tables restored from the earliest build.
      </p>
      <div className="space-y-2">
        <h3 className="font-semibold">Play Type</h3>
        <div className="flex gap-2">
          {[{ id: 'regular', label: 'Regular' }, { id: 'training', label: 'Training' }].map(
            ({ id, label }) => (
              <button
                key={id}
                onClick={() => setPlayType(id)}
                className={`lobby-tile ${playType === id ? 'lobby-selected' : ''}`}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>
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
      {playType === 'regular' ? (
        <div className="space-y-2">
          <h3 className="font-semibold">Stake</h3>
          <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-subtext">
          Training mode skips staking and lets you rehearse on the classic cloth without deductions.
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
