import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { ensureAccountId, getTelegramFirstName, getTelegramId, getTelegramPhotoUrl } from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { resolveTableSize } from '../../config/poolRoyaleTables.js';
import { socket } from '../../utils/socket.js';
import { getOnlineUsers } from '../../utils/api.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { runPoolRoyaleOnlineFlow } from './poolRoyaleOnlineFlow.js';
import {
  TRAINING_LEVELS,
  loadTrainingProgress,
  resolvePlayableTrainingLevel
} from '../../utils/poolRoyaleTrainingProgress.js';

const PLAYER_FLAG_STORAGE_KEY = 'poolRoyalePlayerFlag';
const AI_FLAG_STORAGE_KEY = 'poolRoyaleAiFlag';

export default function PoolRoyaleLobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const searchParams = new URLSearchParams(search);
  const initialPlayType = (() => {
    const requestedType = searchParams.get('type');
    if (requestedType === 'training') return 'training';
    return requestedType === 'tournament' ? 'tournament' : 'regular';
  })();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('ai');
  const [avatar, setAvatar] = useState('');
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [showAiFlagPicker, setShowAiFlagPicker] = useState(false);
  const [playerFlagIndex, setPlayerFlagIndex] = useState(null);
  const [aiFlagIndex, setAiFlagIndex] = useState(null);
  const [variant, setVariant] = useState('uk');
  const [playType, setPlayType] = useState(initialPlayType);
  const [players, setPlayers] = useState(8);
  const tableSize = resolveTableSize(searchParams.get('tableSize')).id;
  const [onlinePlayers, setOnlinePlayers] = useState([]);
  const [matching, setMatching] = useState(false);
  const [spinningPlayer, setSpinningPlayer] = useState('');
  const [matchPlayers, setMatchPlayers] = useState([]);
  const matchPlayersRef = useRef([]);
  const [readyList, setReadyList] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [matchingError, setMatchingError] = useState('');
  const [matchStatus, setMatchStatus] = useState('');
  const spinIntervalRef = useRef(null);
  const accountIdRef = useRef(null);
  const pendingTableRef = useRef('');
  const cleanupRef = useRef(() => {});
  const stakeDebitRef = useRef(null);
  const matchTimeoutRef = useRef(null);
  const seatTimeoutRef = useRef(null);
  const [trainingMode, setTrainingMode] = useState('solo');
  const [trainingRulesOn, setTrainingRulesOn] = useState(true);
  const [trainingProgress, setTrainingProgress] = useState({ completed: [], lastLevel: 1 });
  const [trainingLevel, setTrainingLevel] = useState(1);

  const selectedFlag = playerFlagIndex != null ? FLAG_EMOJIS[playerFlagIndex] : '';
  const selectedAiFlag = aiFlagIndex != null ? FLAG_EMOJIS[aiFlagIndex] : '';
  const completedTrainingSet = useMemo(
    () => new Set((trainingProgress?.completed || []).map((lvl) => Number(lvl))),
    [trainingProgress?.completed]
  );

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const progress = loadTrainingProgress();
      setTrainingProgress(progress);
      const requestedLevel = Number(searchParams.get('level'));
      const desiredLevel = Number.isFinite(requestedLevel) ? requestedLevel : progress.lastLevel;
      setTrainingLevel(resolvePlayableTrainingLevel(desiredLevel, progress));
    } catch {}
  }, [search]);

  useEffect(() => {
    const refreshProgress = () => {
      try {
        const progress = loadTrainingProgress();
        setTrainingProgress(progress);
        setTrainingLevel((prev) => resolvePlayableTrainingLevel(prev, progress));
      } catch {}
    };
    window.addEventListener('focus', refreshProgress);
    window.addEventListener('storage', refreshProgress);
    return () => {
      window.removeEventListener('focus', refreshProgress);
      window.removeEventListener('storage', refreshProgress);
    };
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
    matchPlayersRef.current = matchPlayers;
  }, [matchPlayers]);

  const navigateToPoolRoyale = ({ tableId: startedId, roster = [], accountId }) => {
    const selfId = accountId || accountIdRef.current;
    const selfEntry = roster.find((p) => String(p.id) === String(selfId));
    const opponentEntry = roster.find((p) => String(p.id) !== String(selfId));
    const seatIndex = roster.findIndex((p) => String(p.id) === String(selfId));
    const seat = seatIndex <= 0 ? 'A' : 'B';
    const friendlyName =
      selfEntry?.name ||
      getTelegramFirstName() ||
      getTelegramId() ||
      (selfId ? `TPC ${selfId}` : 'Player');
    const friendlyAvatar = selfEntry?.avatar || avatar;
    const opponentName =
      opponentEntry?.name ||
      opponentEntry?.username ||
      opponentEntry?.telegramName ||
      (opponentEntry?.id ? `TPC ${opponentEntry.id}` : '');
    const opponentAvatar = opponentEntry?.avatar || '';
    cleanupRef.current?.({ account: accountId, skipRefReset: true });
    const params = new URLSearchParams();
    params.set('variant', variant);
    params.set('type', playType);
    params.set('mode', 'online');
    params.set('tableId', startedId);
    if (stake.token) params.set('token', stake.token);
    if (stake.amount) params.set('amount', stake.amount);
    if (friendlyAvatar) params.set('avatar', friendlyAvatar);
    const tgId = getTelegramId();
    if (tgId) params.set('tgId', tgId);
    const resolvedAccountId = accountIdRef.current;
    if (resolvedAccountId) params.set('accountId', resolvedAccountId);
    if (tableSize) params.set('tableSize', tableSize);
    params.set('seat', seat);
    const name = (friendlyName || '').trim();
    if (name) params.set('name', name);
    if (opponentName) params.set('opponent', opponentName);
    if (opponentAvatar) params.set('opponentAvatar', opponentAvatar);
    navigate(`/games/poolroyale?${params.toString()}`);
  };

  const startGame = async () => {
    const isOnlineMatch = mode === 'online' && playType === 'regular';
    const isTraining = playType === 'training';
    if (matching) return;
    await cleanupRef.current?.();
    setMatchStatus('');
    setMatchingError('');

    if (isOnlineMatch) {
      await runPoolRoyaleOnlineFlow({
        stake,
        variant,
        playType,
        mode,
        tableSize,
        avatar,
        deps: { ensureAccountId, getAccountBalance, addTransaction, getTelegramId, getTelegramFirstName, socket },
        state: {
          setMatchingError,
          setMatchStatus,
          setMatching,
          setIsSearching,
          setMatchPlayers,
          setReadyList,
          setSpinningPlayer
        },
        refs: {
          accountIdRef,
          matchPlayersRef,
          pendingTableRef,
          cleanupRef,
          spinIntervalRef,
          stakeDebitRef,
          matchTimeoutRef,
          seatTimeoutRef
        },
        onGameStart: navigateToPoolRoyale
      });
      return;
    }

    let tgId;
    let accountId;
    try {
      tgId = getTelegramId();
      accountId = await ensureAccountId();
    } catch (error) {
      if (!isTraining) {
        const message = 'Unable to verify your TPC account. Please retry.';
        setMatchingError(message);
        try {
          window?.Telegram?.WebApp?.showAlert?.(message);
        } catch {}
        console.error('[PoolRoyaleLobby] ensureAccountId failed (offline)', error);
        return;
      }
      console.warn('[PoolRoyaleLobby] starting training without verified account', error);
    }

    if (accountId) accountIdRef.current = accountId;

    const params = new URLSearchParams();
    params.set('variant', variant);
    params.set('tableSize', tableSize);
    if (isTraining) {
      params.set('type', 'training');
      params.set('mode', trainingMode);
      params.set('rules', trainingRulesOn ? 'on' : 'off');
      if (Number.isFinite(trainingLevel)) params.set('level', trainingLevel);
    } else {
      params.set('type', playType);
      params.set('mode', mode);
      if (isOnlineMatch) {
        if (stake.token) params.set('token', stake.token);
        if (stake.amount) params.set('amount', stake.amount);
      }
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

    if (playType === 'tournament') {
      window.location.href = `/pool-royale-bracket.html?${params.toString()}`;
      return;
    }

    navigate(`/games/poolroyale?${params.toString()}`);
  };

  useEffect(() => {
    let active = true;
    const loadOnline = () => {
      getOnlineUsers()
        .then((data) => {
          if (!active) return;
          const list = Array.isArray(data?.users)
            ? data.users
            : Array.isArray(data)
            ? data
            : [];
          setOnlinePlayers(list);
        })
        .catch(() => {});
    };
    loadOnline();
    const id = setInterval(loadOnline, 15000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const matchingCandidates = useMemo(() => {
    const base = (onlinePlayers || []).map((p) => ({
      id: p.accountId || p.playerId || p.id,
      name: p.username || p.name || p.telegramName || p.telegramId || p.accountId
    }));
    const lobbyEntries = (matchPlayers || []).map((p) => ({ id: p.id, name: p.name || p.id }));
    const merged = [...base, ...lobbyEntries].filter((p) => p.id);
    const seen = new Set();
    return merged.filter((p) => {
      const key = String(p.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [matchPlayers, onlinePlayers]);

  useEffect(() => {
    if (spinIntervalRef.current) {
      clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = null;
    }
    if (!matching || matchingCandidates.length === 0) return undefined;
    setSpinningPlayer(matchingCandidates[0].name || 'Searching…');
    spinIntervalRef.current = setInterval(() => {
      const pick = matchingCandidates[Math.floor(Math.random() * matchingCandidates.length)];
      setSpinningPlayer(pick?.name || 'Searching…');
    }, 500);
    return () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    };
  }, [matching, matchingCandidates]);

  useEffect(() => () => cleanupRef.current?.(), []);

  useEffect(() => {
    if (playType === 'tournament') {
      setMode('ai');
    }
    if (playType === 'training') {
      setMode('ai');
      cleanupRef.current?.();
      setMatching(false);
      setMatchStatus('');
      setMatchPlayers([]);
      setReadyList([]);
      setIsSearching(false);
    }
  }, [playType]);

  useEffect(() => {
    if (mode !== 'online' || playType !== 'regular') {
      cleanupRef.current?.();
      setMatching(false);
      setMatchStatus('');
      setMatchPlayers([]);
      setReadyList([]);
      setIsSearching(false);
    }
  }, [mode, playType]);

  useEffect(() => {
    if (!matching) return;
    const readyIds = new Set((readyList || []).map((id) => String(id)));
    const selfId = accountIdRef.current;
    if (selfId && readyIds.has(String(selfId)) && readyIds.size >= 2) {
      setMatchStatus('All players ready. Launching match…');
    }
  }, [matching, readyList]);

  const readyIds = useMemo(
    () => new Set((readyList || []).map((id) => String(id))),
    [readyList]
  );

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
          {[
            { id: 'ai', label: 'Vs AI' },
            {
              id: 'online',
              label: '1v1 Online',
              disabled: playType === 'tournament' || playType === 'training'
            }
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
                  {playType === 'training' ? 'Training stays offline' : 'Tournament bracket only'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      {playType === 'training' && (
        <div className="space-y-3 p-3 rounded-lg border border-border bg-surface/60">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold">Training tasks</h3>
              <p className="text-xs text-subtext">Pick a drill, then choose solo or AI sparring.</p>
            </div>
            <span className="text-xs text-subtext">
              {completedTrainingSet.size}/{TRAINING_LEVELS.length} done
            </span>
          </div>
          <div className="space-y-2">
            {TRAINING_LEVELS.map((task) => {
              const unlocked = resolvePlayableTrainingLevel(task.level, trainingProgress) === task.level;
              const completed = completedTrainingSet.has(task.level);
              const active = trainingLevel === task.level;
              return (
                <button
                  key={task.level}
                  type="button"
                  onClick={() => unlocked && setTrainingLevel(task.level)}
                  className={`w-full rounded-lg border px-3 py-2 text-left shadow-sm transition ${
                    active ? 'border-primary bg-primary/10' : 'border-border bg-background/60'
                  } ${unlocked ? 'hover:border-primary' : 'opacity-60 cursor-not-allowed'}`}
                  disabled={!unlocked}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">
                        Level {task.level}: {task.title}
                      </div>
                      <div className="text-xs text-subtext leading-snug">{task.objective}</div>
                      <div className="text-[11px] text-emerald-200">{task.reward}</div>
                    </div>
                    <span
                      className={`text-[11px] font-semibold ${
                        completed ? 'text-emerald-400' : unlocked ? 'text-primary' : 'text-subtext'
                      }`}
                    >
                      {completed ? 'Completed' : unlocked ? (active ? 'Selected' : 'Ready') : 'Locked'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'solo', label: 'Solo drills', desc: 'Place the cue ball and retry instantly.' },
              { id: 'ai', label: 'AI sparring', desc: 'Trade turns with a CPU partner.' }
            ].map(({ id, label, desc }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTrainingMode(id)}
                className={`h-full rounded-lg border px-3 py-2 text-left ${
                  trainingMode === id ? 'border-primary bg-primary/10' : 'border-border bg-background/60'
                }`}
              >
                <div className="text-sm font-semibold">{label}</div>
                <div className="text-[11px] text-subtext leading-snug">{desc}</div>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={trainingRulesOn}
              onChange={(event) => setTrainingRulesOn(event.target.checked)}
            />
            <span>Apply fouls and frame rules during training</span>
          </label>
          <p className="text-xs text-subtext">Training is free — no TPC stake required.</p>
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
      {mode === 'online' && playType === 'regular' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Stake</h3>
          <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
          <p className="text-center text-xs text-subtext">
            Online games use your TPC stake as escrow, while AI matches stay free like Chess Battle Royal.
          </p>
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
      {mode === 'online' && playType === 'regular' && (
        <div className="space-y-3 p-3 rounded-lg border border-border bg-surface/60">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Online Arena</h3>
              <p className="text-sm text-subtext">
                We match players by TPC account number, stake ({stake.amount} {stake.token}),
                and Pool Royale game type.
              </p>
            </div>
            <div className="text-xs text-subtext">{onlinePlayers.length} online</div>
          </div>
          {matchingError && (
            <div className="text-sm text-red-400">{matchingError}</div>
          )}
          {matching && (
            <div className="space-y-2">
              {matchStatus && <div className="text-xs text-subtext">{matchStatus}</div>}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Spinning wheel</span>
                <span className="text-xs text-subtext">Searching for stake match…</span>
              </div>
              <div className="lobby-tile w-full flex items-center justify-between">
                <span>🎯 {spinningPlayer || 'Searching…'}</span>
                <span className="text-xs text-subtext">Stake {stake.amount} {stake.token}</span>
              </div>
              <div className="space-y-1">
                {matchPlayers.map((p) => (
                  <div
                    key={p.id}
                    className="lobby-tile w-full flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold">{p.name || `TPC ${p.id}`}</p>
                      <p className="text-xs text-subtext">Account #{p.id}</p>
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        readyIds.has(String(p.id)) ? 'text-emerald-400' : 'text-subtext'
                      }`}
                    >
                      {readyIds.has(String(p.id)) ? 'Ready' : 'Waiting'}
                    </span>
                  </div>
                ))}
                {matchPlayers.length === 0 && (
                  <div className="lobby-tile w-full text-sm text-subtext">
                    Waiting for another player in this pool arena…
                  </div>
                )}
              </div>
            </div>
          )}
          {!matching && (
            <div className="text-sm text-subtext">
              Start to join a 1v1 pool arena. We keep you at the same table until the match begins.
            </div>
          )}
        </div>
      )}
      <button
        onClick={startGame}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded"
        disabled={mode === 'online' && (isSearching || matching)}
      >
        {mode === 'online' ? (matching ? 'Waiting for opponent…' : 'START ONLINE') : 'START'}
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
