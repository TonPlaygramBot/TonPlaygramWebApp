import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import RoomSelector from '../RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  ensureAccountId,
  getTelegramFirstName,
  getTelegramId,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';

const DEFAULT_TABLE_SIZES = [
  { id: '7ft', label: '7 ft' },
  { id: '8ft', label: '8 ft' },
  { id: '9ft', label: '9 ft' }
];

const DEFAULT_MODES = [
  { id: 'ai', label: 'Vs AI', disabled: false },
  { id: 'online', label: '1v1 Online', disabled: true }
];

const DEFAULT_PLAY_TYPES = [
  { id: 'regular', label: 'Regular' },
  { id: 'training', label: 'Training' }
];

function sanitizeOptions(options) {
  return Array.isArray(options) && options.length > 0 ? options : null;
}

export default function BilliardsLobbyBase({
  title,
  gamePath,
  initialVariant = null,
  variantParamKey = 'variant',
  variantOptions = null,
  tableSizeOptions = DEFAULT_TABLE_SIZES,
  initialTableSize = '9ft',
  modeOptions = DEFAULT_MODES,
  initialMode = 'ai',
  playTypeOptions = DEFAULT_PLAY_TYPES,
  initialPlayType = 'regular',
  enableStake = true,
  stakeTokens = ['TPC'],
  defaultStake = { token: 'TPC', amount: 100 },
  buildParams
}) {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const [stake, setStake] = useState(defaultStake);
  const [mode, setMode] = useState(initialMode);
  const [avatar, setAvatar] = useState('');
  const [variant, setVariant] = useState(initialVariant);
  const [tableSize, setTableSize] = useState(initialTableSize);
  const [playType, setPlayType] = useState(initialPlayType);

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  const effectiveVariantOptions = useMemo(
    () => sanitizeOptions(variantOptions),
    [variantOptions]
  );

  const effectiveModeOptions = useMemo(
    () => sanitizeOptions(modeOptions),
    [modeOptions]
  );

  const effectivePlayTypes = useMemo(
    () => sanitizeOptions(playTypeOptions),
    [playTypeOptions]
  );

  const effectiveTableSizes = useMemo(
    () => sanitizeOptions(tableSizeOptions),
    [tableSizeOptions]
  );

  const startGame = async () => {
    let tgId;
    let accountId;
    if (playType !== 'training' && enableStake) {
      try {
        accountId = await ensureAccountId();
        const balRes = await getAccountBalance(accountId);
        const stakeAmount = Number.parseFloat(stake?.amount) || 0;
        let balance = null;
        if (balRes && balRes.balance != null) {
          const rawBalance =
            typeof balRes.balance === 'string'
              ? Number.parseFloat(balRes.balance)
              : balRes.balance;
          if (Number.isFinite(rawBalance)) balance = rawBalance;
        }
        if (balance != null && stakeAmount > 0 && balance < stakeAmount) {
          alert('Insufficient balance');
          return;
        }
        if (balance == null && balRes?.error) {
          console.warn('Failed to read account balance:', balRes.error);
        }
        tgId = getTelegramId();
        await addTransaction(tgId, -stake.amount, 'stake', {
          game: gamePath.replace(/^(\/games\/)/, ''),
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

    const params = new URLSearchParams();
    if (effectivePlayTypes) params.set('type', playType);
    if (playType !== 'training') {
      if (effectiveModeOptions) params.set('mode', mode);
      if (enableStake && stake.token) params.set('token', stake.token);
      if (enableStake && stake.amount) params.set('amount', stake.amount);
    }
    if (variant != null && variantParamKey) params.set(variantParamKey, variant);
    if (effectiveTableSizes && tableSize) params.set('tableSize', tableSize);
    if (avatar) params.set('avatar', avatar);
    if (tgId) params.set('tgId', tgId);
    if (accountId) params.set('accountId', accountId);
    const name = getTelegramFirstName();
    if (name) params.set('name', name);
    const initData = window.Telegram?.WebApp?.initData;
    if (initData) params.set('init', encodeURIComponent(initData));

    if (typeof buildParams === 'function') {
      buildParams(params, {
        stake,
        mode,
        avatar,
        variant,
        tableSize,
        playType
      });
    }

    navigate(`${gamePath}?${params.toString()}`);
  };

  const winnerParam = new URLSearchParams(search).get('winner');

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
      {winnerParam && (
        <div className="text-center font-semibold">
          {winnerParam === '1' ? 'You won!' : 'CPU won!'}
        </div>
      )}
      <h2 className="text-xl font-bold text-center">{title}</h2>
      {effectivePlayTypes && (
        <div className="space-y-2">
          <h3 className="font-semibold">Type</h3>
          <div className="flex gap-2">
            {effectivePlayTypes.map(({ id, label }) => (
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
      )}
      {effectiveModeOptions && playType !== 'training' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Mode</h3>
          <div className="flex gap-2">
            {effectiveModeOptions.map(({ id, label, disabled }) => (
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
      {effectiveVariantOptions && (
        <div className="space-y-2">
          <h3 className="font-semibold">Variant</h3>
          <div className="flex gap-2">
            {effectiveVariantOptions.map(({ id, label }) => (
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
      )}
      {effectiveTableSizes && (
        <div className="space-y-2">
          <h3 className="font-semibold">Table Size</h3>
          <div className="flex gap-2">
            {effectiveTableSizes.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTableSize(id)}
                className={`lobby-tile ${tableSize === id ? 'lobby-selected' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {playType !== 'training' && enableStake && (
        <div className="space-y-2">
          <h3 className="font-semibold">Stake</h3>
          <RoomSelector selected={stake} onSelect={setStake} tokens={stakeTokens} />
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
