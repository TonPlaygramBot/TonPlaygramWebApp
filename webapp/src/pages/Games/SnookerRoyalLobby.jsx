import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { ensureAccountId, getTelegramFirstName, getTelegramId, getTelegramPhotoUrl } from '../../utils/telegram.js';
import { getAccountBalance, addTransaction } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { resolveTableSize } from '../../config/snookerClubTables.js';
import { socket } from '../../utils/socket.js';
import { getOnlineUsers } from '../../utils/api.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { runSnookerRoyalOnlineFlow } from './snookerRoyalOnlineFlow.js';
import OptionIcon from '../../components/OptionIcon.jsx';
import { getLobbyIcon } from '../../config/gameAssets.js';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';

const PLAYER_FLAG_STORAGE_KEY = 'snookerRoyalPlayerFlag';
const AI_FLAG_STORAGE_KEY = 'snookerRoyalAiFlag';

export default function SnookerRoyalLobby() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useTelegramBackButton();

  const searchParams = new URLSearchParams(search);
  const initialPlayType = (() => {
    const requestedType = searchParams.get('type');
    return requestedType === 'tournament' ? 'tournament' : 'regular';
  })();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [mode, setMode] = useState('ai');
  const [avatar, setAvatar] = useState('');
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [showAiFlagPicker, setShowAiFlagPicker] = useState(false);
  const [playerFlagIndex, setPlayerFlagIndex] = useState(null);
  const [aiFlagIndex, setAiFlagIndex] = useState(null);
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
  const forcedVariant = 'snooker';

  const selectedFlag = playerFlagIndex != null ? FLAG_EMOJIS[playerFlagIndex] : '';
  const selectedAiFlag = aiFlagIndex != null ? FLAG_EMOJIS[aiFlagIndex] : '';

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  useEffect(() => {
    import('./SnookerRoyal.jsx').catch(() => {});
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


  const navigateToSnookerRoyal = ({ tableId: startedId, roster = [], accountId, currentTurn }) => {
    const selfId = accountId || accountIdRef.current;
    const selfEntry = roster.find((p) => String(p.id) === String(selfId));
    const opponentEntry = roster.find((p) => String(p.id) !== String(selfId));
    const starterId = currentTurn || roster?.[0]?.id || null;
    const selfIndex = roster.findIndex((p) => String(p.id) === String(selfId));
    const seat = selfIndex === 1 ? 'B' : 'A';
    const starterSeat = starterId && String(starterId) === String(selfId) ? seat : seat === 'A' ? 'B' : 'A';
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
    params.set('variant', forcedVariant);
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
    navigate(`/games/snookerroyale?${params.toString()}`);
  };

  const startGame = async () => {
    const isOnlineMatch = mode === 'online' && playType === 'regular';
    if (matching) return;
    await cleanupRef.current?.();
    setMatchStatus('');
    setMatchingError('');

    if (isOnlineMatch) {
      await runSnookerRoyalOnlineFlow({
        stake,
        variant: forcedVariant,
        ballSet: null,
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
        onGameStart: navigateToSnookerRoyal
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
      console.error('[SnookerRoyalLobby] ensureAccountId failed (offline)', error);
      return;
    }

    accountIdRef.current = accountId;

    const params = new URLSearchParams();
    params.set('variant', forcedVariant);
    params.set('tableSize', tableSize);
    params.set('type', playType);
    params.set('mode', mode);
    if (isOnlineMatch) {
      if (stake.token) params.set('token', stake.token);
      if (stake.amount) params.set('amount', stake.amount);
    }
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
      window.location.href = `/snooker-royale-bracket.html?${params.toString()}`;
      return;
    }

    navigate(`/games/snookerroyale?${params.toString()}`);
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
    <div className="relative min-h-screen bg-[#070b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 space-y-6 p-4 pb-8">
        {winnerParam && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-center text-sm font-semibold text-emerald-200">
            {winnerParam === '1' ? 'You won!' : 'CPU won!'}
          </div>
        )}
        <GameLobbyHeader
          slug="snookerroyale"
          title="Snooker Royal Lobby"
          badge={`${onlinePlayers.length} online`}
        />

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#101828]/80 to-[#0b1324]/90 p-4">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Player Profile</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-full border border-white/15 bg-white/5">
              {avatar ? (
                <img src={avatar} alt="Your avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg">🙂</div>
              )}
            </div>
            <div className="text-sm text-white/80">
              <p className="font-semibold">{getTelegramFirstName() || 'Player'} ready</p>
              <p className="text-xs text-white/50">Flag: {selectedFlag || 'Auto'}</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={() => setShowFlagPicker(true)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80 transition hover:border-white/30"
            >
              <div className="text-[11px] uppercase tracking-wide text-white/50">Flag</div>
              <div className="flex items-center gap-2 text-base font-semibold">
                <span className="text-lg">{selectedFlag || '🌐'}</span>
                <span>{selectedFlag ? 'Custom flag' : 'Auto-detect & save'}</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setShowAiFlagPicker(true)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80 transition hover:border-white/30"
            >
              <div className="text-[11px] uppercase tracking-wide text-white/50">AI Flag</div>
              <div className="flex items-center gap-2 text-base font-semibold">
                <span className="text-lg">{selectedAiFlag || '🌐'}</span>
                <span>{selectedAiFlag ? 'Custom AI flag' : 'Auto-pick opponent'}</span>
              </div>
            </button>
          </div>
          <p className="mt-3 text-xs text-white/60">Your lobby choices persist into the match intro.</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Choose Match Type</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Queue</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                id: 'regular',
                label: 'Regular',
                desc: 'Quick single match',
                accent: 'from-emerald-400/30 via-emerald-500/10 to-transparent',
                icon: '🔴'
              },
              {
                id: 'tournament',
                label: 'Tournament',
                desc: 'Bracket challenge',
                accent: 'from-indigo-400/30 via-sky-500/10 to-transparent',
                icon: '🏆'
              }
            ].map(({ id, label, desc, accent, icon }) => {
              const active = playType === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPlayType(id)}
                  className={`lobby-option-card ${
                    active ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
                  }`}
                >
                  <div className={`lobby-option-thumb bg-gradient-to-br ${accent}`}>
                    <div className="lobby-option-thumb-inner">
                      <OptionIcon
                        src={getLobbyIcon('snookerroyale', `type-${id}`)}
                        alt={label}
                        fallback={icon}
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
          <p className="text-xs text-white/60 text-center">
            Tournament mode locks online matchmaking and uses the bracket flow.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Choose Mode</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Queue</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                id: 'ai',
                label: 'Vs AI',
                desc: 'Instant practice',
                accent: 'from-emerald-400/30 via-emerald-500/10 to-transparent',
                icon: '🤖',
                disabled: false
              },
              {
                id: 'online',
                label: '1v1 Online',
                desc: 'Stake & match',
                accent: 'from-indigo-400/30 via-sky-500/10 to-transparent',
                icon: '⚔️',
                disabled: playType === 'tournament'
              }
            ].map(({ id, label, desc, accent, icon, disabled }) => {
              const active = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => !disabled && setMode(id)}
                  disabled={disabled}
                  className={`lobby-option-card ${
                    active ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
                  } ${disabled ? 'lobby-option-card-disabled' : ''}`}
                >
                  <div className={`lobby-option-thumb bg-gradient-to-br ${accent}`}>
                    <div className="lobby-option-thumb-inner">
                      <OptionIcon
                        src={getLobbyIcon('poolroyale', `mode-${id}`)}
                        alt={label}
                        fallback={icon}
                        className="lobby-option-icon"
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="lobby-option-label">{label}</p>
                    <p className="lobby-option-subtitle">
                      {disabled ? 'Tournament bracket only' : desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-white/60 text-center">
            AI matches stay offline. Online mode uses your TPC stake and pairs you with another player.
          </p>
        </div>

        {playType === 'tournament' && (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-400/40 to-indigo-500/40 p-[1px]">
                <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-xl">
                  🧩
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-white">Tournament Seats</h3>
                <p className="text-xs text-white/60">Choose the bracket size before launching.</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[8, 16, 24].map((p) => {
                const active = players === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlayers(p)}
                    className={`lobby-option-card ${
                      active ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
                    }`}
                  >
                    <div className="lobby-option-thumb bg-gradient-to-br from-purple-400/30 via-indigo-500/10 to-transparent">
                      <div className="lobby-option-thumb-inner">
                        <span className="text-2xl font-semibold">{p}</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="lobby-option-label">{p} Players</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-white/60">
              Winner takes the pot minus a 10% developer fee.
            </p>
          </div>
        )}

        {mode === 'online' && playType === 'regular' && (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-yellow-400/40 to-orange-500/40 p-[1px]">
                <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-xl">
                  💰
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-white">Select Stake</h3>
                <p className="text-xs text-white/60">Stake your TPC to lock a table.</p>
              </div>
            </div>
            <div className="mt-3">
              <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
            </div>
            <p className="text-center text-white/60 text-xs">
              Online games use your TPC stake as escrow, while AI matches stay free.
            </p>
          </div>
        )}

        {mode === 'online' && playType === 'regular' && (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">Online Arena</h3>
                <p className="text-sm text-white/60">
                  We match players by TPC account number, stake ({stake.amount} {stake.token}),
                  and Snooker Royal game type.
                </p>
              </div>
              <div className="text-xs text-white/60">{onlinePlayers.length} online</div>
            </div>
            {matchingError && <div className="text-sm text-red-400">{matchingError}</div>}
            {matching && (
              <div className="space-y-2">
                {matchStatus && <div className="text-xs text-white/60">{matchStatus}</div>}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Spinning wheel</span>
                  <span className="text-xs text-white/60">Searching for stake match…</span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80">
                  <div className="flex items-center justify-between">
                    <span>🎯 {spinningPlayer || 'Searching…'}</span>
                    <span className="text-xs text-white/60">
                      Stake {stake.amount} {stake.token}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  {matchPlayers.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">{p.name || `TPC ${p.id}`}</p>
                          <p className="text-xs text-white/60">Account #{p.id}</p>
                        </div>
                        <span
                          className={`text-xs font-semibold ${
                            readyIds.has(String(p.id)) ? 'text-emerald-400' : 'text-white/50'
                          }`}
                        >
                          {readyIds.has(String(p.id)) ? 'Ready' : 'Waiting'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {matchPlayers.length === 0 && (
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/60">
                      Waiting for another player in this snooker arena…
                    </div>
                  )}
                </div>
              </div>
            )}
            {!matching && (
              <div className="text-sm text-white/60">
                Start to join a 1v1 snooker arena. We keep you at the same table until the match begins.
              </div>
            )}
          </div>
        )}

        <button
          onClick={startGame}
          className="w-full rounded-2xl bg-primary px-4 py-3 text-base font-semibold text-background shadow-[0_16px_30px_rgba(14,165,233,0.35)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          disabled={mode === 'online' && (isSearching || matching)}
        >
          {mode === 'online' ? (matching ? 'Waiting for opponent…' : 'Start Online') : 'Start'}
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
    </div>
  );
}
