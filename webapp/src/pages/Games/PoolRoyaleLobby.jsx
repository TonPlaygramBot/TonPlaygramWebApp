import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  ensureAccountId,
  getTelegramId,
  getTelegramPhotoUrl,
  getTelegramFirstName,
  getPlayerId
} from '../../utils/telegram.js';
import {
  getAccountBalance,
  addTransaction,
  getProfileByAccount,
  getOnlineUsers
} from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { resolveTableSize } from '../../config/poolRoyaleTables.js';

export default function PoolRoyaleLobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('ai');
  const [avatar, setAvatar] = useState('');
  const [variant, setVariant] = useState('uk');
  const searchParams = new URLSearchParams(search);
  const tableSize = resolveTableSize(searchParams.get('tableSize')).id;
  const [playType, setPlayType] = useState('regular');
  const [accountId] = useState(() => getPlayerId());
  const [matchmaking, setMatchmaking] = useState({
    active: false,
    candidates: [],
    highlighted: 0,
    matched: null
  });
  const [matchError, setMatchError] = useState('');
  const pendingMatchParamsRef = useRef('');
  const profileCacheRef = useRef(new Map());
  const [onlineOpponents, setOnlineOpponents] = useState([]);
  const [onlineStatus, setOnlineStatus] = useState({ loading: true, error: '' });

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  useEffect(() => {
    if (!matchmaking.active || matchmaking.candidates.length === 0) return;
    const interval = setInterval(() => {
      setMatchmaking((prev) => {
        if (!prev.active || prev.candidates.length === 0) return prev;
        const next = (prev.highlighted + 1) % prev.candidates.length;
        return { ...prev, highlighted: next };
      });
    }, 140);
    return () => clearInterval(interval);
  }, [matchmaking.active, matchmaking.candidates.length]);

  useEffect(() => {
    if (!matchmaking.active || matchmaking.matched) return;
    if (matchmaking.candidates.length === 0) return;
    const stopDelay = setTimeout(() => {
      setMatchmaking((prev) => {
        if (!prev.active || prev.candidates.length === 0 || prev.matched) {
          return prev;
        }
        const pickIndex = Math.floor(Math.random() * prev.candidates.length);
        return {
          ...prev,
          highlighted: pickIndex,
          matched: prev.candidates[pickIndex]
        };
      });
    }, 2200 + Math.random() * 800);
    return () => clearTimeout(stopDelay);
  }, [matchmaking.active, matchmaking.matched, matchmaking.candidates.length]);

  const resetMatchmakingState = useCallback(() => {
    setMatchmaking({
      active: false,
      candidates: [],
      highlighted: 0,
      matched: null
    });
    pendingMatchParamsRef.current = '';
  }, []);

  const finalizeMatch = useCallback(
    (opponent) => {
      if (!opponent) return;
      const stored = pendingMatchParamsRef.current || '';
      resetMatchmakingState();
      const params = new URLSearchParams(stored);
      params.set('opponentId', opponent.id);
      if (opponent.name) params.set('opponentName', opponent.name);
      if (opponent.rating) params.set('opponentRating', String(opponent.rating));
      if (opponent.city) params.set('opponentCity', opponent.city);
      navigate(`/games/pollroyale?${params.toString()}`);
    },
    [navigate, resetMatchmakingState]
  );

  useEffect(() => {
    if (!matchmaking.active || !matchmaking.matched) return;
    const delay = setTimeout(() => finalizeMatch(matchmaking.matched), 900);
    return () => clearTimeout(delay);
  }, [matchmaking.active, matchmaking.matched, finalizeMatch]);

  useEffect(() => {
    setMatchError('');
  }, [stake.token, stake.amount, variant, playType, mode, onlineOpponents.length]);

  useEffect(() => {
    let cancelled = false;

    async function loadOnlineOpponents() {
      try {
        const res = await getOnlineUsers();
        const raw = Array.isArray(res.users) ? res.users : [];
        const filtered = raw.filter((user) => {
          const id = String(user.id || '');
          return id && id !== accountId;
        });
        const enriched = await Promise.all(
          filtered.map(async (user) => {
            const id = String(user.id);
            let profile = profileCacheRef.current.get(id);
            if (profile === undefined) {
              try {
                profile = await getProfileByAccount(id);
              } catch {
                profile = null;
              }
              profileCacheRef.current.set(id, profile);
            }
            return {
              id,
              name: formatOpponentName(profile, id),
              city: 'Online now',
              rating: estimateRatingFromId(id),
              tokens: ['TPC'],
              stakeRange: { min: 50, max: 20000 },
              variants: ['uk', 'american', '9ball'],
              tableSizes: ['8ft', '9ft'],
              playTypes: ['regular'],
              avatar: profile?.photo || '',
              status: user.status || 'online'
            };
          })
        );
        if (!cancelled) {
          setOnlineOpponents(enriched);
          setOnlineStatus({ loading: false, error: '' });
        }
      } catch (err) {
        if (!cancelled) {
          setOnlineOpponents([]);
          setOnlineStatus({ loading: false, error: 'Failed to load live opponents.' });
        }
      }
    }

    loadOnlineOpponents();
    const id = setInterval(loadOnlineOpponents, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [accountId]);

  const cancelMatchmaking = useCallback(() => {
    resetMatchmakingState();
  }, [resetMatchmakingState]);

  const startGame = async () => {
    if (matchmaking.active) return;
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
          game: 'poolroyale',
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
    params.set('variant', variant);
    params.set('type', playType);
    if (playType !== 'training') params.set('mode', mode);
    const initData = window.Telegram?.WebApp?.initData;
    if (playType !== 'training') {
      if (stake.token) params.set('token', stake.token);
      if (stake.amount) params.set('amount', stake.amount);
    }
    if (avatar) params.set('avatar', avatar);
    if (tgId) params.set('tgId', tgId);
    if (accountId) params.set('accountId', accountId);
    if (tableSize) params.set('tableSize', tableSize);
    const name = getTelegramFirstName();
    if (name) params.set('name', name);
    const devAcc = import.meta.env.VITE_DEV_ACCOUNT_ID;
    const devAcc1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
    const devAcc2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;
    if (devAcc) params.set('dev', devAcc);
    if (devAcc1) params.set('dev1', devAcc1);
    if (devAcc2) params.set('dev2', devAcc2);
    if (initData) params.set('init', encodeURIComponent(initData));
    if (playType !== 'training' && mode === 'online') {
      if (onlineStatus.loading) {
        setMatchError('Loading real opponents… please try again.');
        return;
      }
      if (onlineOpponents.length === 0) {
        setMatchError('No real Pool Royale players are online right now.');
        return;
      }
      const candidates = filterOpponentsByCriteria(onlineOpponents, {
        stake,
        variant,
        tableSize,
        playType
      });
      if (candidates.length === 0) {
        setMatchError(
          'No online opponents match those settings right now. Try another stake or variant.'
        );
        return;
      }
      setMatchError('');
      pendingMatchParamsRef.current = params.toString();
      setMatchmaking({
        active: true,
        candidates,
        highlighted: Math.floor(Math.random() * candidates.length),
        matched: null
      });
      return;
    }
    navigate(`/games/pollroyale?${params.toString()}`);
  };

  const winnerParam = searchParams.get('winner');

  return (
    <>
      <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
        {winnerParam && (
          <div className="text-center font-semibold">
            {winnerParam === '1' ? 'You won!' : 'CPU won!'}
          </div>
        )}
        <h2 className="text-xl font-bold text-center">Pool Royale Lobby</h2>
        {matchError && (
          <div className="rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-center text-sm text-red-200">
            {matchError}
          </div>
        )}
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
          {mode === 'online' && (
            <p className="text-xs text-text/70">
              {onlineStatus.loading
                ? 'Loading live opponents…'
                : onlineOpponents.length > 0
                  ? `${onlineOpponents.length} real players online`
                  : 'No live opponents online right now'}
            </p>
          )}
          {mode === 'online' && onlineStatus.error && (
            <p className="text-xs text-red-400">{onlineStatus.error}</p>
          )}
        </div>
      )}
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
      {matchmaking.active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-background/95 p-4 shadow-2xl">
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-text/70">Matching criteria</p>
              <p className="text-sm font-semibold text-text">
                {variant.toUpperCase()} • {tableSize.toUpperCase()} • {stake.amount.toLocaleString('en-US')} {stake.token}
              </p>
            </div>
            <ul className="max-h-64 space-y-2 overflow-hidden">
            {matchmaking.candidates.map((opponent, idx) => {
              const isActive = idx === matchmaking.highlighted;
              const range = opponent.stakeRange || {};
              const initials =
                opponent.name?.trim().slice(0, 2).toUpperCase() || 'PR';
              return (
                <li
                  key={opponent.id}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    isActive
                        ? 'border-primary bg-primary text-background shadow-lg shadow-primary/40 scale-[1.01]'
                        : 'border-white/10 bg-white/5 text-text/90'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-2">
                        {opponent.avatar ? (
                          <img
                            src={opponent.avatar}
                            alt={opponent.name}
                            className="h-8 w-8 rounded-full object-cover border border-white/30"
                            loading="lazy"
                          />
                        ) : (
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                            {initials}
                          </span>
                        )}
                        <span>{opponent.name}</span>
                      </span>
                      <span>{opponent.rating} ELO</span>
                    </div>
                    <div className="text-xs opacity-80 flex items-center justify-between">
                      <span>
                        {opponent.city} • {opponent.variants?.join('/') || 'All variants'}
                      </span>
                      {opponent.status && (
                        <span className="uppercase">{opponent.status}</span>
                      )}
                    </div>
                    <div className="text-xs opacity-80">
                      {range.min?.toLocaleString('en-US') ?? 0}
                      {range.max ? `-${range.max.toLocaleString('en-US')}` : '+'} {stake.token}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-center text-sm font-medium text-text">
              {matchmaking.matched
                ? `Matched with ${matchmaking.matched.name}`
                : 'Spinning through available challengers…'}
            </p>
            <button
              onClick={cancelMatchmaking}
              className="w-full rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-text hover:bg-white/10"
            >
              Cancel search
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function stakeMatches(range = {}, amount) {
  const min = Number.isFinite(range.min) ? range.min : 0;
  const max = Number.isFinite(range.max) ? range.max : Infinity;
  return amount >= min && amount <= max;
}

function filterOpponentsByCriteria(opponents, criteria) {
  const { stake, variant, tableSize, playType } = criteria;
  if (!stake) return [];
  return opponents.filter((opponent) => {
    const tokenMatch = !opponent.tokens || opponent.tokens.includes(stake.token);
    const stakeMatch = !opponent.stakeRange || stakeMatches(opponent.stakeRange, stake.amount);
    const variantMatch = !opponent.variants || opponent.variants.includes(variant);
    const tableMatch = !opponent.tableSizes || opponent.tableSizes.includes(tableSize);
    const typeMatch = !opponent.playTypes || opponent.playTypes.includes(playType);
    return tokenMatch && stakeMatch && variantMatch && tableMatch && typeMatch;
  });
}

function formatOpponentName(profile, accountId) {
  const nickname = profile?.nickname?.trim();
  if (nickname) return nickname;
  const fullName = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim();
  if (fullName) return fullName;
  const suffix = accountId ? accountId.slice(-4).toUpperCase() : '????';
  return `Player ${suffix}`;
}

function estimateRatingFromId(id) {
  if (!id) return 1500;
  const hash = hashString(id);
  const offset = hash % 400;
  return 1500 - 200 + offset;
}

function hashString(value) {
  if (!value) return 0;
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}
