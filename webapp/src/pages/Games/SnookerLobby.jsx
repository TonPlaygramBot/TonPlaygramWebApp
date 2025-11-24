import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  ensureAccountId,
  getTelegramId,
  getTelegramPhotoUrl,
  getTelegramFirstName
} from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';

const PLAYER_FLAG_STORAGE_KEY = 'snookerPlayerFlag';
const AI_FLAG_STORAGE_KEY = 'snookerAiFlag';
const STAKE_OPTIONS = [100, 500, 1000, 5000, 10000];

const TABLE_CHOICES = Object.freeze([
  {
    id: 'rusticSplit',
    label: 'Pearl Cream Arena',
    description: 'Pool Royale pearl-cream rails with satin brass trim and emerald tour cloth.',
    swatch: ['#f2eadf', '#efe5d6', '#2d7f4b']
  },
  {
    id: 'charredTimber',
    label: 'Charred Timber Elite',
    description: 'Dark roasted planks with bronze trim and the full Pool Royale chrome accents.',
    swatch: ['#3c2c22', '#302118', '#2d7f4b']
  },
  {
    id: 'plankStudio',
    label: 'Plank Studio',
    description: 'Honeyed plank rails with brushed brass trims on the Pool Royale chassis.',
    swatch: ['#b88452', '#ae7a46', '#2d7f4b']
  },
  {
    id: 'weatheredGrey',
    label: 'Weathered Grey Loft',
    description: 'Smoked grey boards with nickel trim and the Royale emerald cloth.',
    swatch: ['#5f5750', '#4e463f', '#2d7f4b']
  },
  {
    id: 'jetBlackCarbon',
    label: 'Carbon Midnight',
    description: 'Matte carbon fibre shell with smoked chrome plates and neon underglow accents.',
    swatch: ['#16181c', '#0d0f12', '#1a1a1c']
  }
]);

export default function SnookerLobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const initialPlayType = useMemo(() => {
    const requested = searchParams.get('type');
    return requested === 'training' || requested === 'tournament'
      ? requested
      : 'regular';
  }, [searchParams]);
  const [playType, setPlayType] = useState(initialPlayType);
  const [mode, setMode] = useState('ai');
  const [players, setPlayers] = useState(8);
  const [trainingMode, setTrainingMode] = useState('solo');
  const [trainingRulesEnabled, setTrainingRulesEnabled] = useState(true);
  const [avatar, setAvatar] = useState('');
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [showAiFlagPicker, setShowAiFlagPicker] = useState(false);
  const [playerFlagIndex, setPlayerFlagIndex] = useState(null);
  const [aiFlagIndex, setAiFlagIndex] = useState(null);
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

  useEffect(() => {
    try {
      const stored = window.localStorage?.getItem(PLAYER_FLAG_STORAGE_KEY);
      const idx = FLAG_EMOJIS.indexOf(stored);
      if (idx >= 0) setPlayerFlagIndex(idx);
    } catch {}
    try {
      const storedAi = window.localStorage?.getItem(AI_FLAG_STORAGE_KEY);
      const idx = FLAG_EMOJIS.indexOf(storedAi);
      if (idx >= 0) setAiFlagIndex(idx);
    } catch {}
  }, []);

  const selectedFlag = playerFlagIndex != null ? FLAG_EMOJIS[playerFlagIndex] : '';
  const selectedAiFlag = aiFlagIndex != null ? FLAG_EMOJIS[aiFlagIndex] : '';

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
          players: playType === 'tournament' ? players : 2,
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
      if (playType === 'tournament') params.set('players', players);
    }
    const initData = window.Telegram?.WebApp?.initData;
    if (avatar) params.set('avatar', avatar);
    if (tgId) params.set('tgId', tgId);
    if (accountId) params.set('accountId', accountId);
    const name = getTelegramFirstName();
    if (name) params.set('name', name);
    if (selectedFlag) params.set('flag', selectedFlag);
    if (selectedAiFlag) params.set('aiFlag', selectedAiFlag);
    const devAcc = import.meta.env.VITE_DEV_ACCOUNT_ID;
    const devAcc1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
    const devAcc2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;
    if (devAcc) params.set('dev', devAcc);
    if (devAcc1) params.set('dev1', devAcc1);
    if (devAcc2) params.set('dev2', devAcc2);
    if (initData) params.set('init', encodeURIComponent(initData));

    navigate(`/games/snooker?${params.toString()}`);
  };

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
        <div className="flex flex-wrap gap-2">
          {[{ id: 'regular', label: 'Regular' }, { id: 'training', label: 'Training' }, { id: 'tournament', label: 'Tournament' }].map(
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

      {playType !== 'training' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Mode</h3>
          <div className="flex gap-2">
            {[{ id: 'ai', label: 'Vs AI' }, { id: 'online', label: '1v1 Online', disabled: true }].map(
              ({ id, label, disabled }) => (
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
                    <span className="absolute inset-0 flex items-center justify-center text-xs bg-black/60 text-background">
                      Under development
                    </span>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {playType === 'training' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Training Mode</h3>
          <div className="grid grid-cols-2 gap-2">
            {[{ id: 'solo', label: 'Solo' }, { id: 'gauntlet', label: 'Gauntlet' }].map(
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
            <button
              onClick={() => setTrainingRulesEnabled((v) => !v)}
              className={`lobby-tile col-span-2 ${trainingRulesEnabled ? 'lobby-selected' : ''}`}
            >
              Rules {trainingRulesEnabled ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      )}

      {playType === 'tournament' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Players</h3>
          <div className="flex gap-2">
            {[4, 8, 16].map((count) => (
              <button
                key={count}
                onClick={() => setPlayers(count)}
                className={`lobby-tile ${players === count ? 'lobby-selected' : ''}`}
              >
                {count}-player bracket
              </button>
            ))}
          </div>
        </div>
      )}

      {playType !== 'training' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Stake</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {STAKE_OPTIONS.map((amount) => (
              <button
                key={amount}
                onClick={() => setStake({ token: 'TPC', amount })}
                className={`lobby-tile ${stake.amount === amount ? 'lobby-selected' : ''}`}
              >
                TPC {amount.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-semibold">Table Finish</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {TABLE_CHOICES.map((choice) => (
            <button
              key={choice.id}
              onClick={() => setTableFinish(choice.id)}
              className={`lobby-tile ${tableFinish === choice.id ? 'lobby-selected' : ''} text-left`}
            >
              <div className="font-semibold">{choice.label}</div>
              <div className="text-xs text-subtext">{choice.description}</div>
              {choice.swatch && (
                <div className="flex items-center gap-1 mt-1">
                  {choice.swatch.map((color) => (
                    <span
                      key={color}
                      className="w-6 h-3 rounded-full border border-border/60"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Your Flag &amp; Avatar</h3>
        <div className="flex items-center gap-3">
          <button
            className="lobby-tile flex items-center gap-2"
            onClick={() => setShowFlagPicker(true)}
          >
            <span className="text-xl">{selectedFlag || '🌐'}</span>
            <span className="text-sm text-subtext">Auto-detect &amp; save</span>
          </button>
          {avatar ? (
            <img
              src={avatar}
              alt="avatar"
              className="w-14 h-14 rounded-full object-cover border border-border"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-border" />
          )}
        </div>
        <p className="text-xs text-subtext">Your avatar will appear in the match intro.</p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">AI Avatar Flags</h3>
        <button
          className="lobby-tile flex items-center gap-2"
          onClick={() => setShowAiFlagPicker(true)}
        >
          <span className="text-xl">{selectedAiFlag || '🌐'}</span>
          <span className="text-sm text-subtext">Pick the country flag for the AI rival</span>
        </button>
      </div>

      <button
        onClick={startGame}
        className="btn btn-primary w-full py-3 text-lg font-semibold"
      >
        Start Match
      </button>

      <FlagPickerModal
        open={showFlagPicker}
        onClose={() => setShowFlagPicker(false)}
        onSelect={(emoji) => {
          const idx = FLAG_EMOJIS.indexOf(emoji);
          if (idx >= 0) {
            setPlayerFlagIndex(idx);
            window.localStorage?.setItem(PLAYER_FLAG_STORAGE_KEY, emoji);
          }
          setShowFlagPicker(false);
        }}
      />
      <FlagPickerModal
        open={showAiFlagPicker}
        onClose={() => setShowAiFlagPicker(false)}
        onSelect={(emoji) => {
          const idx = FLAG_EMOJIS.indexOf(emoji);
          if (idx >= 0) {
            setAiFlagIndex(idx);
            window.localStorage?.setItem(AI_FLAG_STORAGE_KEY, emoji);
          }
          setShowAiFlagPicker(false);
        }}
      />
    </div>
  );
}
