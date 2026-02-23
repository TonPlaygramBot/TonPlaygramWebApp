import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  ensureAccountId,
  getTelegramFirstName,
  getTelegramId,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { resolveTableSize } from '../../config/poolRoyaleTables.js';
import { socket } from '../../utils/socket.js';
import { getOnlineUsers } from '../../utils/api.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { runPoolRoyaleOnlineFlow } from './poolRoyaleOnlineFlow.js';
import OptionIcon from '../../components/OptionIcon.jsx';
import { getLobbyIcon, getVariantThumbnail } from '../../config/gameAssets.js';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';
import {
  TRAINING_LEVEL_COUNT,
  loadTrainingProgress
} from '../../utils/poolRoyaleTrainingProgress.js';
import {
  CAREER_LEVEL_COUNT,
  getCareerRoadmap,
  getNextCareerStage,
  loadCareerProgress
} from '../../utils/poolRoyaleCareerProgress.js';

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
    if (requestedType === 'career') return 'career';
    return requestedType === 'tournament' ? 'tournament' : 'regular';
  })();
  const initialMode = searchParams.get('mode') === 'online' ? 'online' : 'ai';
  const autoStartRequested = searchParams.get('autostart') === '1';

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState(initialMode);
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
  const [onlinePlayers, setOnlinePlayers] = useState([]);
  const [matching, setMatching] = useState(false);
  const [spinningPlayer, setSpinningPlayer] = useState('');
  const [matchPlayers, setMatchPlayers] = useState([]);
  const matchPlayersRef = useRef([]);
  const [readyList, setReadyList] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [matchingError, setMatchingError] = useState('');
  const [matchStatus, setMatchStatus] = useState('');
  const [trainingProgress, setTrainingProgress] = useState({
    completed: [],
    rewarded: [],
    lastLevel: 1,
    carryShots: 3
  });
  const [activeTournament, setActiveTournament] = useState(null);
  const [careerProgress, setCareerProgress] = useState(() =>
    loadCareerProgress()
  );
  const spinIntervalRef = useRef(null);
  const accountIdRef = useRef(null);
  const pendingTableRef = useRef('');
  const cleanupRef = useRef(() => {});
  const stakeDebitRef = useRef(null);
  const matchTimeoutRef = useRef(null);
  const seatTimeoutRef = useRef(null);
  const autoStartRef = useRef(false);

  const selectedFlag =
    playerFlagIndex != null ? FLAG_EMOJIS[playerFlagIndex] : '';
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
    matchPlayersRef.current = matchPlayers;
  }, [matchPlayers]);

  useEffect(() => {
    if (variant !== 'uk') {
      setUkBallSet('uk');
    }
  }, [variant]);

  const navigateToPoolRoyale = ({
    tableId: startedId,
    roster = [],
    accountId,
    currentTurn
  }) => {
    const selfId = accountId || accountIdRef.current;
    const selfEntry = roster.find((p) => String(p.id) === String(selfId));
    const opponentEntry = roster.find((p) => String(p.id) !== String(selfId));
    const starterId = currentTurn || roster?.[0]?.id || null;
    const selfIndex = roster.findIndex((p) => String(p.id) === String(selfId));
    const seat = selfIndex === 1 ? 'B' : 'A';
    const starterSeat =
      starterId && String(starterId) === String(selfId)
        ? seat
        : seat === 'A'
          ? 'B'
          : 'A';
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
    if (variant === 'uk' && ukBallSet === 'american') {
      params.set('ballSet', 'american');
    }
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
    params.set('starter', starterSeat);
    const name = (friendlyName || '').trim();
    if (name) params.set('name', name);
    if (opponentName) params.set('opponent', opponentName);
    if (opponentAvatar) params.set('opponentAvatar', opponentAvatar);
    navigate(`/games/poolroyale?${params.toString()}`);
  };

  const startGame = async ({ trainingLevelOverride = null } = {}) => {
    const nextCareerStage =
      playType === 'career'
        ? getNextCareerStage(trainingProgress, careerProgress)
        : null;
    const effectivePlayType =
      playType === 'career' ? nextCareerStage?.type || 'training' : playType;
    const isOnlineMatch = mode === 'online' && playType === 'regular';
    if (matching) return;
    await cleanupRef.current?.();
    setMatchStatus('');
    setMatchingError('');

    if (isOnlineMatch) {
      await runPoolRoyaleOnlineFlow({
        stake,
        variant,
        ballSet: ukBallSet,
        playType,
        mode,
        tableSize,
        avatar,
        deps: {
          ensureAccountId,
          getAccountBalance,
          addTransaction,
          getTelegramId,
          getTelegramFirstName,
          socket
        },
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
      const message = 'Unable to verify your TPC account. Please retry.';
      setMatchingError(message);
      try {
        window?.Telegram?.WebApp?.showAlert?.(message);
      } catch {}
      console.error(
        '[PoolRoyaleLobby] ensureAccountId failed (offline)',
        error
      );
      return;
    }

    accountIdRef.current = accountId;

    const params = new URLSearchParams();
    params.set('variant', variant);
    if (variant === 'uk' && ukBallSet === 'american') {
      params.set('ballSet', 'american');
    }
    params.set('tableSize', tableSize);
    params.set(
      'type',
      effectivePlayType === 'friendly' ? 'regular' : effectivePlayType
    );
    params.set('mode', mode);
    if (playType === 'career') {
      params.set('career', '1');
      if (nextCareerStage?.id) params.set('careerStageId', nextCareerStage.id);
      if (nextCareerStage?.title)
        params.set('careerStageTitle', nextCareerStage.title);
      if (nextCareerStage?.type === 'tournament' && nextCareerStage?.players) {
        params.set('players', String(nextCareerStage.players));
      }
    }
    if (effectivePlayType === 'training') {
      const requested = Number(
        playType === 'career'
          ? nextCareerStage?.trainingLevel
          : trainingLevelOverride
      );
      if (Number.isFinite(requested) && requested > 0) {
        params.set(
          'trainingLevel',
          String(Math.min(TRAINING_LEVEL_COUNT, Math.floor(requested)))
        );
      }
    }
    if (isOnlineMatch) {
      if (stake.token) params.set('token', stake.token);
      if (stake.amount) params.set('amount', stake.amount);
    }
    if (effectivePlayType === 'tournament' && !params.get('players')) {
      params.set('players', String(players));
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

    if (effectivePlayType === 'tournament') {
      window.location.href = `/pool-royale-bracket.html?${params.toString()}`;
      return;
    }

    navigate(`/games/poolroyale?${params.toString()}`);
  };
  useEffect(() => {
    if (!autoStartRequested || autoStartRef.current || matching) return;
    autoStartRef.current = true;
    startGame();
  }, [autoStartRequested, matching, startGame]);

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
      name:
        p.username || p.name || p.telegramName || p.telegramId || p.accountId
    }));
    const lobbyEntries = (matchPlayers || []).map((p) => ({
      id: p.id,
      name: p.name || p.id
    }));
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
      const pick =
        matchingCandidates[
          Math.floor(Math.random() * matchingCandidates.length)
        ];
      setSpinningPlayer(pick?.name || 'Searching…');
    }, 500);
    return () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    };
  }, [matching, matchingCandidates]);

  useEffect(() => () => cleanupRef.current?.(), []);

  useEffect(() => {
    if (
      playType === 'tournament' ||
      playType === 'training' ||
      playType === 'career'
    ) {
      setMode('ai');
    }
  }, [playType]);

  useEffect(() => {
    if (playType !== 'training' && playType !== 'career') return;
    const loadedTraining = loadTrainingProgress();
    setTrainingProgress(loadedTraining);
    setCareerProgress(loadCareerProgress());
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
  const careerRoadmapNodes = useMemo(
    () => getCareerRoadmap(trainingProgress, careerProgress),
    [trainingProgress, careerProgress]
  );
  const nextCareerTask = useMemo(
    () => getNextCareerStage(trainingProgress, careerProgress),
    [trainingProgress, careerProgress]
  );

  const tournamentKey = getTelegramId() || 'anon';
  const tournamentStateKey = `poolRoyaleTournamentState_${tournamentKey}`;
  const tournamentOppKey = `poolRoyaleTournamentOpponent_${tournamentKey}`;
  const hasActiveTournament =
    playType === 'tournament' && Boolean(activeTournament);

  useEffect(() => {
    if (typeof window === 'undefined' || playType !== 'tournament') {
      setActiveTournament(null);
      return;
    }
    try {
      const raw = window.localStorage.getItem(tournamentStateKey);
      if (!raw) {
        setActiveTournament(null);
        return;
      }
      const parsed = JSON.parse(raw);
      const totalPlayers = Number(parsed?.N || parsed?.players?.length || 0);
      if (
        parsed?.complete ||
        !Number.isFinite(totalPlayers) ||
        totalPlayers <= 0
      ) {
        setActiveTournament(null);
        return;
      }
      setActiveTournament({
        ...parsed,
        N: Math.max(2, Math.floor(totalPlayers / 2) * 2)
      });
    } catch (err) {
      console.warn('Pool Royale active tournament load failed', err);
      setActiveTournament(null);
    }
  }, [playType, tournamentStateKey]);

  const winnerParam = searchParams.get('winner');

  return (
    <div className="relative min-h-screen bg-[#070b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 space-y-6 p-4 pb-8">
        {winnerParam && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-center text-sm font-semibold text-emerald-200">
            {winnerParam === '1' ? 'You won!' : 'CPU won!'}
          </div>
        )}
        <GameLobbyHeader
          slug="poolroyale"
          title="Pool Royal Lobby"
          badge={`${onlinePlayers.length} online`}
        />

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#101828]/80 to-[#0b1324]/90 p-4">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">
            Player Profile
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-full border border-white/15 bg-white/5">
              {avatar ? (
                <img
                  src={avatar}
                  alt="Your avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg">
                  🙂
                </div>
              )}
            </div>
            <div className="text-sm text-white/80">
              <p className="font-semibold">
                {getTelegramFirstName() || 'Player'} ready
              </p>
              <p className="text-xs text-white/50">
                Flag: {selectedFlag || 'Auto'}
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={() => setShowFlagPicker(true)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80 transition hover:border-white/30"
            >
              <div className="text-[11px] uppercase tracking-wide text-white/50">
                Flag
              </div>
              <div className="flex items-center gap-2 text-base font-semibold">
                <span className="text-lg">{selectedFlag || '🌐'}</span>
                <span>
                  {selectedFlag ? 'Custom flag' : 'Auto-detect & save'}
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setShowAiFlagPicker(true)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80 transition hover:border-white/30"
            >
              <div className="text-[11px] uppercase tracking-wide text-white/50">
                AI Flag
              </div>
              <div className="flex items-center gap-2 text-base font-semibold">
                <span className="text-lg">{selectedAiFlag || '🌐'}</span>
                <span>
                  {selectedAiFlag ? 'Custom AI flag' : 'Auto-pick opponent'}
                </span>
              </div>
            </button>
          </div>
          <p className="mt-3 text-xs text-white/60">
            Your lobby choices persist into the match intro.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Choose Match Type</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">
              Queue
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              {
                id: 'regular',
                label: 'Regular',
                desc: 'Quick single match',
                accent: 'from-emerald-400/30 via-emerald-500/10 to-transparent',
                iconKey: 'type-regular'
              },
              {
                id: 'tournament',
                label: 'Tournament',
                desc: 'Bracket challenge',
                accent: 'from-indigo-400/30 via-sky-500/10 to-transparent',
                iconKey: 'type-tournament'
              },
              {
                id: 'training',
                label: 'Practice',
                desc: 'Open-table warmup',
                accent: 'from-cyan-400/30 via-emerald-500/10 to-transparent',
                iconKey: 'type-training'
              },
              {
                id: 'career',
                label: 'Career',
                desc: 'Road to legend',
                accent: 'from-amber-400/30 via-orange-500/10 to-transparent',
                iconKey: 'type-tournament'
              }
            ].map(({ id, label, desc, accent, iconKey }) => {
              const active = playType === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPlayType(id)}
                  className={`lobby-option-card ${
                    active
                      ? 'lobby-option-card-active'
                      : 'lobby-option-card-inactive'
                  }`}
                >
                  <div
                    className={`lobby-option-thumb bg-gradient-to-br ${accent}`}
                  >
                    <div className="lobby-option-thumb-inner">
                      <OptionIcon
                        src={getLobbyIcon('poolroyale', iconKey)}
                        alt={label}
                        fallback={
                          id === 'regular'
                            ? '🎯'
                            : id === 'tournament'
                              ? '🏆'
                              : id === 'training'
                                ? '🧪'
                                : '🛣️'
                        }
                        className="lobby-option-icon"
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="lobby-option-label">{label}</p>
                    <p className="lobby-option-subtitle">{desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {playType !== 'training' &&
          playType !== 'career' &&
          !hasActiveTournament && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Play Mode</h3>
                <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">
                  Opponents
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    id: 'ai',
                    label: 'Vs AI',
                    desc: 'Practice precision',
                    iconKey: 'mode-ai'
                  },
                  {
                    id: 'online',
                    label: '1v1 Online',
                    desc: 'Live matchmaking',
                    iconKey: 'mode-online',
                    disabled:
                      playType === 'tournament' || playType === 'training'
                  }
                ].map(({ id, label, desc, iconKey, disabled }) => {
                  const active = mode === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => !disabled && setMode(id)}
                      disabled={disabled}
                      className={`lobby-option-card ${
                        active
                          ? 'lobby-option-card-active'
                          : 'lobby-option-card-inactive'
                      } ${disabled ? 'lobby-option-card-disabled' : ''}`}
                    >
                      <div className="lobby-option-thumb bg-gradient-to-br from-sky-400/30 via-indigo-500/10 to-transparent">
                        <div className="lobby-option-thumb-inner">
                          <OptionIcon
                            src={getLobbyIcon('poolroyale', iconKey)}
                            alt={label}
                            fallback={id === 'ai' ? '🤖' : '🌐'}
                            className="lobby-option-icon"
                          />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="lobby-option-label">{label}</p>
                        <p className="lobby-option-subtitle">
                          {disabled
                            ? `${playType === 'training' ? 'Practice is offline only' : 'Tournament bracket only'}`
                            : desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        {playType !== 'training' && playType !== 'career' && !hasActiveTournament && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Game Variant</h3>
                <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">
                  Ruleset
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'uk', label: '8Ball' },
                  { id: 'american', label: 'American' },
                  { id: '9ball', label: '9-Ball' }
                ].map(({ id, label }) => {
                  const active = variant === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setVariant(id)}
                      className={`lobby-option-card ${
                        active
                          ? 'lobby-option-card-active'
                          : 'lobby-option-card-inactive'
                      }`}
                    >
                      <div className="lobby-option-thumb bg-gradient-to-br from-amber-400/30 via-sky-500/10 to-transparent">
                        <div className="lobby-option-thumb-inner">
                          <OptionIcon
                            src={getVariantThumbnail('poolroyale', id)}
                            alt={label}
                            fallback="🎱"
                            className="lobby-option-icon"
                          />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="lobby-option-label">{label}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        {playType !== 'career' && !hasActiveTournament && variant === 'uk' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Ball Colors</h3>
                <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">
                  Visuals
                </span>
              </div>
              <p className="text-xs text-white/60">
                Keep UK yellow/red sets or switch to solids &amp; stripes
                visuals while retaining 8Ball rules.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'uk', label: 'Yellow & Red' },
                  { id: 'american', label: 'Solids & Stripes' }
                ].map(({ id, label }) => {
                  const active = ukBallSet === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setUkBallSet(id)}
                      className={`lobby-option-card ${
                        active
                          ? 'lobby-option-card-active'
                          : 'lobby-option-card-inactive'
                      }`}
                    >
                      <div className="lobby-option-thumb bg-gradient-to-br from-amber-400/30 via-rose-500/10 to-transparent">
                        <div className="lobby-option-thumb-inner">
                          <OptionIcon
                            src={getLobbyIcon('poolroyale', `ball-${id}`)}
                            alt={label}
                            fallback={id === 'uk' ? '🟡' : '🔵'}
                            className="lobby-option-icon"
                          />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="lobby-option-label">{label}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        {playType === 'training' && (
          <div className="space-y-3 rounded-2xl border border-emerald-300/30 bg-gradient-to-br from-emerald-500/10 via-black/35 to-cyan-500/10 p-4">
            <div>
              <h3 className="font-semibold text-white">Free Practice</h3>
              <p className="text-xs text-white/60">
                Practice is open-table mode: no AI and no rule penalties.
                Choose any variant, set your preferred ball colors, then start and
                practice shots freely.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-xs text-white/70">
                <p>
                All guided practice tasks were moved to Career mode as progression
                stages.
              </p>
              <p className="mt-1 text-white/60">
                Open Career when you want structured objectives and rewards.
              </p>
            </div>
          </div>
        )}

        {playType === 'career' && (
          <div className="space-y-3 rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-500/12 via-black/35 to-indigo-500/12 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">Career Roadmap</h3>
                <p className="text-xs text-white/60">
                  Mixed drills, match tasks, and tournaments with detailed phase progression.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/games/poolroyale/career')}
                  className="rounded-lg border border-amber-200/55 bg-black/35 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100"
                >
                  Open
                </button>
                <span className="text-xs font-semibold text-amber-200">
                  {careerRoadmapNodes.filter((node) => node.completed).length}/
                  {CAREER_LEVEL_COUNT}
                </span>
              </div>
            </div>
            {nextCareerTask ? (
              <div className="rounded-xl border border-amber-300/45 bg-amber-300/10 p-3 text-xs text-amber-50">
                <p className="font-semibold uppercase tracking-[0.16em]">
                  Next milestone
                </p>
                <div className="mt-1 flex items-start gap-2.5">
                  {nextCareerTask?.giftThumbnail ? (
                    <img
                      src={nextCareerTask.giftThumbnail}
                      alt="Next career gift"
                      className="h-12 w-16 rounded-lg border border-amber-100/30 object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {nextCareerTask.icon} {nextCareerTask.title}
                    </p>
                    <p className="mt-1 text-white/75">{nextCareerTask.objective}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/40 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                    <img
                      src="/assets/icons/ezgif-54c96d8a9b9236.webp"
                      alt="TPC"
                      className="h-3.5 w-3.5"
                    />
                    {Number(nextCareerTask.rewardTpc || 0).toLocaleString(
                      'en-US'
                    )}{' '}
                    TPC
                  </span>
                  {nextCareerTask.hasGift ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/50 bg-amber-300/12 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                      <span>🎁</span>
                      Bonus crate
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-300/45 bg-emerald-300/10 p-3 text-xs text-emerald-100">
                Career complete. You are the Pool Royale Legend.
              </div>
            )}
            <button
              type="button"
              onClick={() => startGame()}
              disabled={!nextCareerTask}
              className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                nextCareerTask
                  ? 'bg-amber-300 text-black hover:bg-amber-200'
                  : 'cursor-not-allowed bg-white/10 text-white/45'
              }`}
            >
              {nextCareerTask ? 'Launch next career match' : 'Career complete'}
            </button>
            <div className="max-h-96 overflow-y-auto pr-1">
              <div className="relative pl-2">
                <div className="absolute left-[1.35rem] top-2 bottom-2 w-[2px] rounded-full bg-gradient-to-b from-amber-300/60 via-indigo-300/45 to-emerald-300/20" />
                <div className="space-y-2.5">
                  {careerRoadmapNodes.map((stage, index) => (
                    <div
                      key={stage.id}
                      className="relative flex items-start gap-3"
                    >
                      <button
                        type="button"
                        onClick={() => stage.playable && startGame()}
                        disabled={!stage.playable}
                        className={`relative z-10 mt-1 flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 text-base font-semibold shadow-[0_10px_22px_rgba(0,0,0,0.45)] transition ${
                          stage.completed
                            ? 'border-emerald-200 bg-emerald-300/20 text-emerald-50'
                            : stage.playable
                              ? 'border-amber-200 bg-amber-300/20 text-amber-50'
                              : 'cursor-not-allowed border-white/15 bg-black/35 text-white/35'
                        }`}
                        aria-label={`Launch career stage ${stage.level}`}
                      >
                        {stage.icon}
                      </button>
                      <button
                        type="button"
                        onClick={() => stage.playable && startGame()}
                        disabled={!stage.playable}
                        className={`flex min-w-0 flex-1 flex-col items-start gap-2 rounded-2xl border px-3 py-3 text-left transition ${
                          stage.playable
                            ? 'border-amber-300/55 bg-amber-300/10 shadow-[0_10px_24px_rgba(251,191,36,0.18)]'
                            : stage.completed
                              ? 'border-emerald-300/50 bg-emerald-400/10'
                              : 'cursor-not-allowed border-white/10 bg-white/[0.01]'
                        }`}
                      >
                        <div className="flex w-full min-w-0 items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-white">
                              Stage {String(index + 1).padStart(3, '0')} ·{' '}
                              {stage.title}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] text-white/70">
                              {stage.objective}
                            </p>
                          </div>
                          <span
                            className={`ml-2 shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] ${stage.completed ? 'text-emerald-200' : stage.playable ? 'text-amber-100' : 'text-white/35'}`}
                          >
                            {stage.statusLabel}
                          </span>
                        </div>
                        <div className="flex w-full flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/90">
                            {stage.type === 'training'
                              ? '🎯 Drill'
                              : stage.type === 'friendly'
                                ? '🤝 Match'
                                : stage.type === 'league'
                                  ? '🗓️ League'
                                  : stage.type === 'showdown'
                                    ? '⚡ Showdown'
                                    : '🏆 Tournament'}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/40 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                            <img
                              src="/assets/icons/ezgif-54c96d8a9b9236.webp"
                              alt="TPC"
                              className="h-3.5 w-3.5"
                            />
                            {Number(stage.rewardTpc || 0).toLocaleString(
                              'en-US'
                            )}{' '}
                            TPC
                          </span>
                          {stage.hasGift ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/50 bg-amber-300/12 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                              <span>🎁</span>
                              Gift bonus
                            </span>
                          ) : null}
                          {stage.hasGift && stage.giftThumbnail ? (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200/50 bg-black/25 px-1.5 py-1 text-[10px] font-semibold text-amber-50">
                              <img
                                src={stage.giftThumbnail}
                                alt="Gift reward thumbnail"
                                className="h-7 w-7 rounded object-cover"
                                loading="lazy"
                              />
                              Gift preview
                            </span>
                          ) : null}
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {playType === 'tournament' && !hasActiveTournament && (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4">
            <h3 className="font-semibold text-white">Tournament Players</h3>
            <div className="flex flex-wrap gap-2">
              {[8, 16, 32].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlayers(p)}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                    players === p
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30'
                  }`}
                >
                  {p} Players
                </button>
              ))}
            </div>
            <p className="text-xs text-white/50">
              Winner takes pot minus 10% developer fee.
            </p>
          </div>
        )}

        {hasActiveTournament && (
          <div className="space-y-3 rounded-2xl border border-indigo-300/30 bg-gradient-to-br from-indigo-500/15 via-black/30 to-sky-500/15 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">Active Tournament</h3>
                <p className="text-xs text-white/65">
                  Continue your current bracket or reset and start a new one.
                </p>
              </div>
              <span className="rounded-full border border-white/20 px-2 py-1 text-[11px] text-white/80">
                {activeTournament?.N || 0} players
              </span>
            </div>
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
              <iframe
                title="Active tournament bracket"
                src={`/pool-royale-bracket.html?type=tournament&players=${activeTournament?.N || 8}&tgId=${encodeURIComponent(tournamentKey)}&embed=1`}
                className="h-[420px] w-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set('type', 'tournament');
                  params.set('players', String(activeTournament?.N || 8));
                  params.set('tgId', tournamentKey);
                  window.location.href = `/pool-royale-bracket.html?${params.toString()}`;
                }}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-background"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => {
                  window.localStorage.removeItem(tournamentStateKey);
                  window.localStorage.removeItem(tournamentOppKey);
                  setActiveTournament(null);
                }}
                className="rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Start New Tournament
              </button>
            </div>
          </div>
        )}

        {mode === 'online' && playType === 'regular' && (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Stake</h3>
              <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">
                TPC
              </span>
            </div>
            <RoomSelector
              selected={stake}
              onSelect={setStake}
              tokens={['TPC']}
            />
            <p className="text-center text-xs text-white/50">
              Online games use your TPC stake as escrow, while AI matches stay
              free.
            </p>
          </div>
        )}

        {mode === 'online' && playType === 'regular' && (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-gradient-to-br from-[#101828]/80 to-[#0b1324]/90 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">Online Arena</h3>
                <p className="text-sm text-white/60">
                  We match players by TPC account number, stake ({stake.amount}{' '}
                  {stake.token}), and Pool Royale game type.
                </p>
              </div>
              <div className="text-xs text-white/50">
                {onlinePlayers.length} online
              </div>
            </div>
            {matchingError && (
              <div className="text-sm text-red-400">{matchingError}</div>
            )}
            {matching && (
              <div className="space-y-2">
                {matchStatus && (
                  <div className="text-xs text-white/50">{matchStatus}</div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">
                    Spinning wheel
                  </span>
                  <span className="text-xs text-white/50">
                    Searching for stake match…
                  </span>
                </div>
                <div className="lobby-tile w-full flex items-center justify-between">
                  <span>🎯 {spinningPlayer || 'Searching…'}</span>
                  <span className="text-xs text-white/60">
                    Stake {stake.amount} {stake.token}
                  </span>
                </div>
                <div className="space-y-1">
                  {matchPlayers.map((p) => (
                    <div
                      key={p.id}
                      className="lobby-tile w-full flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {p.name || `TPC ${p.id}`}
                        </p>
                        <p className="text-xs text-white/50">Account #{p.id}</p>
                      </div>
                      <span
                        className={`text-xs font-semibold ${
                          readyIds.has(String(p.id))
                            ? 'text-emerald-400'
                            : 'text-white/50'
                        }`}
                      >
                        {readyIds.has(String(p.id)) ? 'Ready' : 'Waiting'}
                      </span>
                    </div>
                  ))}
                  {matchPlayers.length === 0 && (
                    <div className="lobby-tile w-full text-sm text-white/50">
                      Waiting for another player in this pool arena…
                    </div>
                  )}
                </div>
              </div>
            )}
            {!matching && (
              <div className="text-sm text-white/50">
                Start to join a 1v1 pool arena. We keep you at the same table
                until the match begins.
              </div>
            )}
          </div>
        )}

        {playType !== 'career' && !hasActiveTournament && (
            <button
              onClick={startGame}
              className="w-full rounded-2xl bg-primary px-4 py-3 text-base font-semibold text-background transition hover:bg-primary-hover"
              disabled={mode === 'online' && (isSearching || matching)}
            >
              {mode === 'online'
                ? matching
                  ? 'Waiting for opponent…'
                  : 'START ONLINE'
                : 'START'}
            </button>
          )}

        <FlagPickerModal
          open={showFlagPicker}
          count={1}
          selected={playerFlagIndex != null ? [playerFlagIndex] : []}
          onSave={(indices) => {
            const idx = indices?.[0] ?? null;
            setPlayerFlagIndex(idx);
            try {
              if (idx != null)
                window.localStorage?.setItem(
                  PLAYER_FLAG_STORAGE_KEY,
                  FLAG_EMOJIS[idx]
                );
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
              if (idx != null)
                window.localStorage?.setItem(
                  AI_FLAG_STORAGE_KEY,
                  FLAG_EMOJIS[idx]
                );
            } catch {}
          }}
          onClose={() => setShowAiFlagPicker(false)}
        />
      </div>
    </div>
  );
}
