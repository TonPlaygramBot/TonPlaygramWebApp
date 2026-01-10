import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { ensureAccountId, getTelegramFirstName, getTelegramId, getTelegramPhotoUrl } from '../../utils/telegram.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { resolveTableSize } from '../../config/poolRoyaleTables.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';

const PLAYER_FLAG_STORAGE_KEY = 'poolRoyalePlayerFlag';
const AI_FLAG_STORAGE_KEY = 'poolRoyaleAiFlag';

export default function PoolRoyaleLobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const searchParams = new URLSearchParams(search);
  const initialPlayType = (() => {
    const requestedType = searchParams.get('type');
    return requestedType === 'tournament' ? 'tournament' : 'regular';
  })();

  const mode = 'ai';
  const [avatar, setAvatar] = useState('');
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [showAiFlagPicker, setShowAiFlagPicker] = useState(false);
  const [playerFlagIndex, setPlayerFlagIndex] = useState(null);
  const [aiFlagIndex, setAiFlagIndex] = useState(null);
  const [variant, setVariant] = useState('uk');
  const [ukBallSet, setUkBallSet] = useState('uk');
  const [playType, setPlayType] = useState(initialPlayType);
  const [players, setPlayers] = useState(8);
  const tableSize = resolveTableSize(searchParams.get('tableSize')).id;
  const accountIdRef = useRef(null);

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

  useEffect(() => {
    if (variant !== 'uk') {
      setUkBallSet('uk');
    }
  }, [variant]);

  const startGame = async () => {
    let tgId;
    let accountId;
    try {
      tgId = getTelegramId();
      accountId = await ensureAccountId();
    } catch (error) {
      const message = 'Unable to verify your TPC account. Please retry.';
      try {
        window?.Telegram?.WebApp?.showAlert?.(message);
      } catch {}
      console.error('[PoolRoyaleLobby] ensureAccountId failed (offline)', error);
      return;
    }

    accountIdRef.current = accountId;

    const params = new URLSearchParams();
    params.set('variant', variant);
    if (variant === 'uk' && ukBallSet === 'american') {
      params.set('ballSet', 'american');
    }
    params.set('tableSize', tableSize);
    params.set('type', playType);
    params.set('mode', mode);
    if (playType === 'tournament') params.set('players', players);
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

    if (playType === 'tournament') {
      window.location.href = `/pool-royale-bracket.html?${params.toString()}`;
      return;
    }

    navigate(`/games/poolroyale?${params.toString()}`);
  };

  const winnerParam = searchParams.get('winner');

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
      {winnerParam && (
        <div className="text-center font-semibold">
          {winnerParam === '1' ? 'You won!' : 'CPU won!'}
        </div>
      )}
      <h2 className="text-xl font-bold text-center">Pool Royale Lobby</h2>
      <div className="space-y-2">
        <h3 className="font-semibold">Type</h3>
        <div className="flex gap-2">
          {[
            { id: 'regular', label: 'Regular' },
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
        <h3 className="font-semibold">Variant</h3>
        <div className="flex gap-2">
          {[
            { id: 'uk', label: '8 Pool UK' },
            { id: 'american', label: 'American' },
            { id: '9ball', label: '9-Ball' }
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setVariant(id)}
              className={`lobby-tile ${variant === id ? 'lobby-selected' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {variant === 'uk' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Ball Colors</h3>
          <p className="text-xs text-subtext">
            Keep UK yellow/red sets or switch to Solids &amp; Stripes visuals while retaining 8 Pool UK rules.
          </p>
          <div className="flex gap-2">
            {[{ id: 'uk', label: 'Yellow & Red' }, { id: 'american', label: 'Solids & Stripes' }].map(
              ({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setUkBallSet(id)}
                  className={`lobby-tile ${ukBallSet === id ? 'lobby-selected' : ''}`}
                >
                  {label}
                </button>
              )
            )}
          </div>
        </div>
      )}
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
