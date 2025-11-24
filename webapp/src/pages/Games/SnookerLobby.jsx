import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
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

const PLAYER_FLAG_STORAGE_KEY = 'snookerPlayerFlag';
const AI_FLAG_STORAGE_KEY = 'snookerAiFlag';

export default function SnookerLobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const initialPlayType = (() => {
    const params = new URLSearchParams(search);
    const requested = params.get('type');
    return requested === 'training' || requested === 'tournament'
      ? requested
      : 'regular';
  })();
  const [playType, setPlayType] = useState(initialPlayType);
  const [mode, setMode] = useState('ai');
  const [trainingMode, setTrainingMode] = useState('solo');
  const [trainingRulesEnabled, setTrainingRulesEnabled] = useState(true);
  const [avatar, setAvatar] = useState('');
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [showAiFlagPicker, setShowAiFlagPicker] = useState(false);
  const [playerFlagIndex, setPlayerFlagIndex] = useState(null);
  const [aiFlagIndex, setAiFlagIndex] = useState(null);
  const [players] = useState(8);
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
    try {
      const stored = window.localStorage?.getItem(PLAYER_FLAG_STORAGE_KEY);
      const idx = FLAG_EMOJIS.indexOf(stored);
      if (idx >= 0) setPlayerFlagIndex(idx);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage?.getItem(AI_FLAG_STORAGE_KEY);
      const idx = FLAG_EMOJIS.indexOf(stored);
      if (idx >= 0) setAiFlagIndex(idx);
    } catch {}
  }, []);

  useEffect(() => {
    if (playType !== 'regular') {
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
    const selectedFlag =
      playerFlagIndex != null ? FLAG_EMOJIS[playerFlagIndex] : undefined;
    const selectedAiFlag = aiFlagIndex != null ? FLAG_EMOJIS[aiFlagIndex] : undefined;
    if (selectedFlag) {
      params.set('flag', selectedFlag);
      try {
        window.localStorage?.setItem(PLAYER_FLAG_STORAGE_KEY, selectedFlag);
      } catch {}
    }
    if (selectedAiFlag) {
      params.set('aiFlag', selectedAiFlag);
      try {
        window.localStorage?.setItem(AI_FLAG_STORAGE_KEY, selectedAiFlag);
      } catch {}
    }
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
            { id: 'training', label: 'Training' },
            { id: 'tournament', label: 'Tournament' }
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
      <div className="space-y-2">
        <h3 className="font-semibold">Mode</h3>
        <div className="flex gap-2">
          {[{ id: 'ai', label: 'Vs AI' }, { id: 'online', label: '1v1 Online', disabled: playType !== 'regular' }].map(
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
              </div>
            )
          )}
        </div>
      </div>
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
      {playType !== 'training' ? (
        <div className="space-y-2">
          <h3 className="font-semibold">Stake</h3>
          <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-subtext">
          Training mode skips staking and lets you rehearse on the Pool Royale-spec snooker cloth.
        </div>
      )}
      <div className="space-y-2">
        <h3 className="font-semibold">Your Flag &amp; Avatar</h3>
        <div className="lobby-tile flex items-center gap-3">
          <img
            src={avatar || '/assets/icons/profile.svg'}
            alt="avatar"
            className="h-12 w-12 rounded-full border border-white/20 object-cover"
          />
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setShowFlagPicker(true)}
              className="rounded-full border border-white/20 px-3 py-1 text-left text-sm hover:border-emerald-300 hover:text-white"
            >
              <span className="mr-2">Flag</span>
              <span className="text-lg align-middle">
                {playerFlagIndex != null ? FLAG_EMOJIS[playerFlagIndex] : '🌐'}
              </span>
            </button>
            <span className="text-xs text-subtext">Auto-detect &amp; save</span>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">AI Avatar Flags</h3>
        <div className="lobby-tile flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Pick the country flag for the AI rival</span>
            <span className="text-xs text-subtext">AI Flag</span>
          </div>
          <button
            onClick={() => setShowAiFlagPicker(true)}
            className="rounded-full border border-white/20 px-3 py-1 text-sm hover:border-emerald-300 hover:text-white"
          >
            {aiFlagIndex != null ? FLAG_EMOJIS[aiFlagIndex] : '🌐'}
          </button>
        </div>
      </div>
      <button
        onClick={startGame}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded"
      >
        START
      </button>
      <FlagPickerModal
        open={showFlagPicker}
        onClose={() => setShowFlagPicker(false)}
        onSave={(indices) => {
          setPlayerFlagIndex(indices?.[0] ?? null);
        }}
        selected={playerFlagIndex != null ? [playerFlagIndex] : []}
      />
      <FlagPickerModal
        open={showAiFlagPicker}
        onClose={() => setShowAiFlagPicker(false)}
        onSave={(indices) => {
          setAiFlagIndex(indices?.[0] ?? null);
        }}
        selected={aiFlagIndex != null ? [aiFlagIndex] : []}
      />
    </div>
  );
}
