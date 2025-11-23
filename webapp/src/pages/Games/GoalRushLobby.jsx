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

const AI_FLAG_STORAGE_KEY = 'goalRushAiFlag';
const PLAYER_FLAG_STORAGE_KEY = 'goalRushPlayerFlag';

export default function GoalRushLobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('ai');
  const [goal, setGoal] = useState(3);
  const [avatar, setAvatar] = useState('');
  const [playType, setPlayType] = useState('regular');
  const [players, setPlayers] = useState(8);
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [showAiFlagPicker, setShowAiFlagPicker] = useState(false);
  const [playerFlagIndex, setPlayerFlagIndex] = useState(null);
  const [aiFlagIndex, setAiFlagIndex] = useState(null);

  const selectedFlag = playerFlagIndex != null ? FLAG_EMOJIS[playerFlagIndex] : '';
  const selectedAiFlag = aiFlagIndex != null ? FLAG_EMOJIS[aiFlagIndex] : '';

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

  const startGame = async () => {
    let tgId;
    let accountId;
    if (playType !== 'training') {
      try {
        accountId = await ensureAccountId();
        const balRes = await getAccountBalance(accountId);
        if ((balRes.balance || 0) < stake.amount) {
          alert('Insufficient balance');
          return;
        }
        tgId = getTelegramId();
        await addTransaction(tgId, -stake.amount, 'stake', {
          game: 'goalrush',
          players: playType === 'tournament' ? players : 2,
          accountId,
        });
      } catch {}
    } else {
      try {
        tgId = getTelegramId();
        accountId = await ensureAccountId();
      } catch {}
    }

    const params = new URLSearchParams(search);
    params.set('target', goal);
    params.set('type', playType);
    if (playType !== 'training') params.set('mode', mode);
    if (playType === 'tournament') params.set('players', players);
    const initData = window.Telegram?.WebApp?.initData;
    if (playType !== 'training') {
      if (stake.token) params.set('token', stake.token);
      if (stake.amount) params.set('amount', stake.amount);
    }
    if (avatar) params.set('avatar', avatar);
    if (selectedFlag) params.set('flag', selectedFlag);
    if (selectedAiFlag) params.set('aiFlag', selectedAiFlag);
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
    if (playType === 'tournament') {
      window.location.href = `/goal-rush-bracket.html?${params.toString()}`;
    } else {
      navigate(`/games/goalrush?${params.toString()}`);
    }
  };

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
      <h2 className="text-xl font-bold text-center">Goal Rush Lobby</h2>
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
        <h3 className="font-semibold">Goals</h3>
        <div className="flex gap-2">
          {[3, 5, 10].map((g) => (
            <button
              key={g}
              onClick={() => setGoal(g)}
              className={`lobby-tile ${goal === g ? 'lobby-selected' : ''}`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      {playType === 'tournament' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Players</h3>
          <div className="flex gap-2">
            {[8, 16, 24].map((p) => (
              <button
                key={p}
                onClick={() => setPlayers(p)}
                className={`lobby-tile ${players === p ? 'lobby-selected' : ''}`}
              >
                {p}
              </button>
            ))}
          </div>
          <p className="text-xs">Winner takes pot minus 10% developer fee.</p>
        </div>
      )}
      {playType !== 'training' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Stake</h3>
          <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-semibold">Your Flag & Avatar</h3>
        <div className="rounded-xl border border-border bg-surface/60 p-3 space-y-2 shadow">
          <button
            type="button"
            onClick={() => setShowFlagPicker(true)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background/60 hover:border-primary text-sm text-left"
          >
            <div className="text-[11px] uppercase tracking-wide text-subtext">Flag</div>
            <div className="flex items-center gap-2 text-base font-semibold">
              <span className="text-lg">{selectedFlag || '🌐'}</span>
              <span>{selectedFlag ? 'Custom flag' : 'Auto-detect & save'}</span>
            </div>
          </button>
          {avatar && (
            <div className="flex items-center gap-3">
              <img
                src={avatar}
                alt="Your avatar"
                className="h-12 w-12 rounded-full border border-border object-cover"
              />
              <div className="text-sm text-subtext">Your avatar will appear in the match intro.</div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">AI Avatar Flags</h3>
        <p className="text-sm text-subtext">
          Pick the country flag for the AI rival so it matches the Chess Battle Royal lobby experience.
        </p>
        <button
          type="button"
          onClick={() => setShowAiFlagPicker(true)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background/60 hover:border-primary text-sm text-left"
        >
          <div className="text-[11px] uppercase tracking-wide text-subtext">AI Flag</div>
          <div className="flex items-center gap-2 text-base font-semibold">
            <span className="text-lg">{selectedAiFlag || '🌐'}</span>
            <span>{selectedAiFlag ? 'Custom AI flag' : 'Auto-pick for opponent'}</span>
          </div>
        </button>
      </div>
      <button
        onClick={startGame}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded"
      >
        START
      </button>

      <FlagPickerModal
        open={showFlagPicker}
        count={1}
        selected={playerFlagIndex != null ? [playerFlagIndex] : []}
        onSave={(indices) => {
          const idx = indices?.[0] ?? null;
          setPlayerFlagIndex(idx);
          try {
            if (idx != null) window.localStorage?.setItem(PLAYER_FLAG_STORAGE_KEY, FLAG_EMOJIS[idx]);
          } catch {}
        }}
        onClose={() => setShowFlagPicker(false)}
      />

      <FlagPickerModal
        open={showAiFlagPicker}
        count={1}
        selected={aiFlagIndex != null ? [aiFlagIndex] : []}
        onSave={(indices) => {
          const idx = indices?.[0] ?? null;
          setAiFlagIndex(idx);
          try {
            if (idx != null) window.localStorage?.setItem(AI_FLAG_STORAGE_KEY, FLAG_EMOJIS[idx]);
          } catch {}
        }}
        onClose={() => setShowAiFlagPicker(false)}
      />
    </div>
  );
}

