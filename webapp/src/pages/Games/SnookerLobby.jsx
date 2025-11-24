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

const TABLE_CHOICES = Object.freeze([
  {
    id: 'rusticSplit',
    label: 'Pearl Cream Arena',
    description: 'Pool Royale pearl-cream rails with satin brass trim and emerald tour cloth.'
  },
  {
    id: 'charredTimber',
    label: 'Charred Timber Elite',
    description: 'Dark roasted planks with bronze trim and the full Pool Royale chrome accents.'
  },
  {
    id: 'jetBlackCarbon',
    label: 'Carbon Midnight',
    description: 'Matte carbon fibre shell with smoked chrome plates and neon underglow accents.'
  }
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
  const [trainingMode, setTrainingMode] = useState('solo');
  const [trainingRulesEnabled, setTrainingRulesEnabled] = useState(true);
  const [avatar, setAvatar] = useState('');
  const [tableFinish, setTableFinish] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const requested = params.get('finish');
        if (requested && TABLE_CHOICES.some((option) => option.id === requested)) {
          return requested;
        }
      } catch {}
      try {
        const stored = window.localStorage.getItem('snookerTableFinish');
        if (stored && TABLE_CHOICES.some((option) => option.id === stored)) {
          return stored;
        }
      } catch {}
    }
    return TABLE_CHOICES[0].id;
  });

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  useEffect(() => {
    if (playType === 'training') {
      setMode('ai');
    }
  }, [playType]);

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
    const resolvedMode = playType === 'training' ? trainingMode : mode;
    params.set('mode', resolvedMode);
    if (playType === 'training') {
      params.set('rules', trainingRulesEnabled ? 'on' : 'off');
    }
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
        Match the Pool Royale lobby flow with official snooker tables built from Royale parts.
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
      {playType === 'training' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">Training options</h3>
            <div className="lobby-tile flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold">Opponent</p>
                <p className="text-xs text-subtext">Practice alone or alternate turns with the AI.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[{ id: 'solo', label: 'Solo practice' }, { id: 'ai', label: 'Vs AI' }].map(
                    ({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => setTrainingMode(id)}
                        className={`lobby-tile ${trainingMode === id ? 'lobby-selected' : ''}`}
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold">Rules</p>
                <p className="text-xs text-subtext">Play official fouls or switch to a free table.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[{ id: true, label: 'With rules' }, { id: false, label: 'No rules' }].map(
                    ({ id, label }) => (
                      <button
                        key={String(id)}
                        onClick={() => setTrainingRulesEnabled(Boolean(id))}
                        className={`lobby-tile ${trainingRulesEnabled === Boolean(id) ? 'lobby-selected' : ''}`}
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <h3 className="font-semibold">Table</h3>
        <div className="space-y-2">
          {TABLE_CHOICES.map(({ id, label, description }) => (
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
      {playType === 'regular' ? (
        <div className="space-y-2">
          <h3 className="font-semibold">Stake</h3>
          <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-subtext">
          Training mode skips staking and lets you rehearse on the Pool Royale-spec snooker cloth.
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
