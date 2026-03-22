import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import RoomSelector from '../../components/RoomSelector.jsx';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  ensureAccountId,
  getTelegramId,
  getTelegramFirstName,
  getTelegramPhotoUrl,
  getTelegramUsername
} from '../../utils/telegram.js';
import { getAccountBalance, addTransaction, getOnlineCount } from '../../utils/api.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { socket } from '../../utils/socket.js';
import OptionIcon from '../../components/OptionIcon.jsx';
import { getLobbyIcon } from '../../config/gameAssets.js';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';

const DEV_ACCOUNT = import.meta.env.VITE_DEV_ACCOUNT_ID;
const DEV_ACCOUNT_1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
const DEV_ACCOUNT_2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;
const AI_FLAG_STORAGE_KEY = 'checkersBattleRoyalAiFlag';
const CHECKERS_HOST_CODE_STORAGE_KEY = 'checkersBattleRoyalHostCode';
const SOCKET_CONNECT_TIMEOUT_MS = 6000;

function normalizeHostCode(code = '') {
  return String(code || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toUpperCase()
    .slice(0, 48);
}

function buildHostedTableId(code = '') {
  const safeCode = normalizeHostCode(code);
  if (!safeCode) return '';
  return `checkers-2-host-${safeCode}`;
}

async function ensureSocketConnected(timeoutMs = SOCKET_CONNECT_TIMEOUT_MS) {
  if (socket.connected) return true;

  return new Promise((resolve) => {
    let settled = false;

    const cleanup = () => {
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleError);
      socket.off('error', handleError);
    };

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(result);
    };

    const handleConnect = () => finish(true);
    const handleError = () => finish(false);

    const timer = setTimeout(() => finish(socket.connected), timeoutMs);
    socket.once('connect', handleConnect);
    socket.once('connect_error', handleError);
    socket.once('error', handleError);
    socket.connect?.();
  });
}

export default function CheckersBattleRoyalLobby() {
  const navigate = useNavigate();
  useTelegramBackButton();

  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [avatar, setAvatar] = useState('');
  const [mode, setMode] = useState('ai');
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [showAiFlagPicker, setShowAiFlagPicker] = useState(false);
  const [playerFlagIndex, setPlayerFlagIndex] = useState(null);
  const [aiFlagIndex, setAiFlagIndex] = useState(null);
  const [onlineCount, setOnlineCount] = useState(null);
  const [accountId, setAccountId] = useState('');
  const [matching, setMatching] = useState(false);
  const [matchStatus, setMatchStatus] = useState('');
  const [matchError, setMatchError] = useState('');
  const [preferredSide, setPreferredSide] = useState('auto');
  const [onlineQueueMode, setOnlineQueueMode] = useState('quick');
  const [hostCodeInput, setHostCodeInput] = useState('');
  const pendingTableRef = useRef('');
  const cleanupRef = useRef(() => {});

  const selectedFlag = playerFlagIndex != null ? FLAG_EMOJIS[playerFlagIndex] : '';
  const selectedAiFlag = aiFlagIndex != null ? FLAG_EMOJIS[aiFlagIndex] : '';

  useEffect(() => {
    import('./CheckersBattleRoyal.jsx').catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage?.getItem('checkersBattleRoyalPlayerFlag');
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
    let cancelled = false;
    ensureAccountId()
      .then((id) => {
        if (cancelled) return;
        setAccountId(id || '');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchOnline = () => {
      getOnlineCount()
        .then((d) => {
          if (!active) return;
          setOnlineCount(d?.count ?? 0);
        })
        .catch(() => {});
    };
    fetchOnline();
    const interval = setInterval(fetchOnline, 20000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => () => cleanupRef.current?.(), []);

  useEffect(() => {
    try {
      const stored = window.localStorage?.getItem(CHECKERS_HOST_CODE_STORAGE_KEY) || '';
      setHostCodeInput(normalizeHostCode(stored));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (hostCodeInput) {
        window.localStorage?.setItem(
          CHECKERS_HOST_CODE_STORAGE_KEY,
          normalizeHostCode(hostCodeInput)
        );
      } else {
        window.localStorage?.removeItem(CHECKERS_HOST_CODE_STORAGE_KEY);
      }
    } catch {}
  }, [hostCodeInput]);

  const navigateToGame = (extraParams = {}) => {
    const params = new URLSearchParams();
    const initData = window.Telegram?.WebApp?.initData;
    const isOnline = mode === 'online';

    if (isOnline && stake.token) params.set('token', stake.token);
    if (isOnline && stake.amount) params.set('amount', stake.amount);
    if (avatar) params.set('avatar', avatar);
    if (extraParams.tgId) params.set('tgId', extraParams.tgId);
    if (isOnline && (extraParams.trackedAccountId || accountId))
      params.set('accountId', extraParams.trackedAccountId || accountId);
    if (selectedFlag) params.set('flag', selectedFlag);
    if (!isOnline && selectedAiFlag) params.set('aiFlag', selectedAiFlag);
    if (preferredSide) params.set('preferredSide', preferredSide);
    if (DEV_ACCOUNT) params.set('dev', DEV_ACCOUNT);
    if (DEV_ACCOUNT_1) params.set('dev1', DEV_ACCOUNT_1);
    if (DEV_ACCOUNT_2) params.set('dev2', DEV_ACCOUNT_2);
    if (isOnline && initData) params.set('init', encodeURIComponent(initData));
    params.set('mode', mode);

    Object.entries(extraParams).forEach(([key, value]) => {
      if (value != null && key !== 'tgId' && key !== 'trackedAccountId') {
        params.set(key, value);
      }
    });

    navigate(`/games/checkersbattleroyal?${params.toString()}`);
  };

  const cleanupLobby = ({ account, skipRefReset } = {}) => {
    socket.off('gameStart');
    socket.off('lobbyUpdate');
    if (pendingTableRef.current && (account || accountId)) {
      socket.emit('leaveLobby', {
        accountId: account || accountId,
        tableId: pendingTableRef.current
      });
    }
    pendingTableRef.current = '';
    setMatching(false);
    setMatchStatus('');
    if (!skipRefReset) cleanupRef.current = null;
  };

  const startGame = async () => {
    const isOnline = mode === 'online';
    if (matching) return;
    let tgId;
    let trackedAccountId;
    if (isOnline) {
      try {
        trackedAccountId = await ensureAccountId();
        if (trackedAccountId) setAccountId((prev) => prev || trackedAccountId);
        const balRes = await getAccountBalance(trackedAccountId);
        if ((balRes.balance || 0) < stake.amount) {
          alert('Insufficient balance');
          return;
        }
        tgId = getTelegramId();
        await addTransaction(tgId, -stake.amount, 'stake', {
          game: 'checkersbattle',
          players: 2,
          accountId: trackedAccountId,
        });
      } catch {}

      if (!trackedAccountId) {
        setMatchError('Unable to resolve your player account. Reopen Telegram and try again.');
        setMatching(false);
        setMatchStatus('');
        return;
      }
    }

    if (!isOnline) {
      navigateToGame({ tgId, trackedAccountId });
      return;
    }

    setMatchError('');
    setMatching(true);
    setMatchStatus('Connecting to lobby…');

    const socketReady = await ensureSocketConnected();
    if (!socketReady) {
      setMatchError('Lobby connection failed. Check your network and try again.');
      setMatching(false);
      setMatchStatus('');
      return;
    }

    const handleLobbyUpdate = ({ tableId: tid, players: list = [] } = {}) => {
      if (!tid || tid !== pendingTableRef.current) return;
      const others = list.filter((p) => String(p.id) !== String(trackedAccountId || accountId));
      if (others.length > 0) {
        setMatchStatus('Opponent joined. Locking seats…');
      } else {
        setMatchStatus('Waiting for another player…');
      }
    };

    const handleGameStart = ({ tableId: startedId, players = [] } = {}) => {
      if (!startedId || startedId !== pendingTableRef.current) return;
      const meIndex = players.findIndex((p) => String(p.id) === String(trackedAccountId || accountId));
      const opp = players.find((p) => String(p.id) !== String(trackedAccountId || accountId));
      const mySide =
        players.find((p) => String(p.id) === String(trackedAccountId || accountId))?.side ||
        (meIndex === 0 ? 'white' : 'black');
      cleanupLobby({ account: trackedAccountId });
      navigateToGame({
        tgId,
        trackedAccountId,
        tableId: startedId,
        side: mySide,
        opponentName: opp?.name,
        opponentAvatar: opp?.avatar
      });
    };

    cleanupRef.current = () => cleanupLobby({ account: trackedAccountId, skipRefReset: true });

    socket.on('gameStart', handleGameStart);
    socket.on('lobbyUpdate', handleLobbyUpdate);
    socket.emit('register', { playerId: trackedAccountId });

    const friendlyName = getTelegramFirstName() || getTelegramUsername() || 'Player';
    const hostedTableId =
      onlineQueueMode === 'quick' ? '' : buildHostedTableId(hostCodeInput);
    if (onlineQueueMode !== 'quick' && !hostedTableId) {
      setMatchError('Enter a host code to create or join a private online table.');
      setMatching(false);
      setMatchStatus('');
      return;
    }

    socket.emit(
      'seatTable',
      {
        accountId: trackedAccountId || accountId,
        gameType: 'checkers',
        stake: stake.amount ?? 0,
        maxPlayers: 2,
        playerName: friendlyName,
        avatar,
        preferredSide,
        ...(hostedTableId ? { tableId: hostedTableId } : {})
      },
      (res) => {
        if (!res?.success || !res.tableId) {
          setMatchError('Could not join the online lobby. Please try again.');
          cleanupLobby({ account: trackedAccountId });
          return;
        }
        pendingTableRef.current = res.tableId;
        setMatchStatus(
          hostedTableId
            ? `Private table ready (${normalizeHostCode(hostCodeInput)}). Waiting for your invited opponent…`
            : 'Waiting for another player…'
        );
        socket.emit('confirmReady', {
          accountId: trackedAccountId,
          tableId: res.tableId
        });
      }
    );
  };

  return (
    <div className="relative min-h-screen bg-[#070b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 space-y-4 p-4 pb-8">
        <GameLobbyHeader
          slug="checkersbattleroyal"
          title="Checkers Battle Royal Lobby"
          badge={onlineCount != null ? `${onlineCount} online` : 'Syncing…'}
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
          <p className="mt-3 text-xs text-white/60">Your lobby choices persist into the match start screen.</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Choose Mode</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Queue</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                key: 'ai',
                label: 'Vs AI',
                desc: 'Instant practice',
                accent: 'from-sky-400/30 via-indigo-500/10 to-transparent',
                icon: '🤖',
                iconKey: 'mode-ai'
              },
              {
                key: 'online',
                label: 'Online',
                desc: 'Stake & match',
                accent: 'from-sky-400/30 via-indigo-500/10 to-transparent',
                icon: '⚔️',
                iconKey: 'mode-online'
              }
            ].map(({ key, label, desc, accent, icon, iconKey }) => {
              const active = mode === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  className={`lobby-option-card ${
                    active ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
                  }`}
                >
                  <div className={`lobby-option-thumb bg-gradient-to-br ${accent}`}>
                    <div className="lobby-option-thumb-inner">
                      <OptionIcon
                        src={getLobbyIcon('poolroyale', iconKey)}
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
            AI matches stay offline. Online mode uses your TPC stake and pairs you with another player.
          </p>
        </div>

        {mode === 'online' && (
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
              Staking uses your TPC account{accountId ? ` #${accountId}` : ''} as escrow for every online round.
            </p>
          </div>
        )}

        {mode === 'online' && (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Online Table Type</h3>
              <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Host</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'quick', label: 'Quick Match', desc: 'Auto-join public queue', icon: '🌐' },
                { key: 'host', label: 'Host / Join', desc: 'Use private host code', icon: '🛡️' }
              ].map((item) => {
                const active = onlineQueueMode === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setOnlineQueueMode(item.key)}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-white/10 bg-white/5 text-white/80 hover:border-white/30'
                    }`}
                  >
                    <div className="text-lg">{item.icon}</div>
                    <div className="mt-1 text-sm font-semibold">{item.label}</div>
                    <div className="text-[11px] text-white/60">{item.desc}</div>
                  </button>
                );
              })}
            </div>
            {onlineQueueMode === 'host' && (
              <div className="space-y-2">
                <label className="block text-xs uppercase tracking-wide text-white/50">
                  Host code (share with your opponent)
                </label>
                <input
                  value={hostCodeInput}
                  onChange={(e) => setHostCodeInput(normalizeHostCode(e.target.value))}
                  placeholder="e.g. ALBANIA-ROOM-01"
                  className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none transition focus:border-primary/70"
                  maxLength={48}
                />
                <p className="text-xs text-white/60">
                  Both players must use the same host code and stake amount to enter this private table.
                </p>
              </div>
            )}
          </div>
        )}

        {mode === 'online' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Pick Your Pieces</h3>
              <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Sides</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  key: 'auto',
                  label: 'Auto',
                  desc: 'Random seats, no duplicates',
                  accent: 'from-slate-400/30 via-slate-500/10 to-transparent',
                  icon: '🎲'
                },
                {
                  key: 'white',
                  label: 'White',
                  desc: 'You start first',
                  accent: 'from-white/40 via-white/10 to-transparent',
                  icon: '♔'
                },
                {
                  key: 'black',
                  label: 'Black',
                  desc: 'Opponent opens',
                  accent: 'from-gray-500/30 via-gray-700/10 to-transparent',
                  icon: '♚'
                }
              ].map(({ key, label, desc, accent, icon }) => {
                const active = preferredSide === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPreferredSide(key)}
                    className={`flex flex-col gap-3 rounded-2xl border px-4 py-4 text-left shadow transition ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-white/10 bg-black/30 text-white/80 hover:border-white/30'
                    }`}
                  >
                    <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${accent} p-[1px]`}>
                      <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-xl">
                        {icon}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{label}</span>
                        {active && <span className="text-[10px] font-bold uppercase">Selected</span>}
                      </div>
                      <div className="text-xs text-white/60">{desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-white/60 text-center">
              Auto randomizes colors while ensuring both players get different sides.
            </p>
          </div>
        )}

        

        {mode === 'online' && matching && (
          <div className="space-y-2 rounded-2xl border border-primary/40 bg-primary/5 p-4 shadow">
            <h3 className="font-semibold text-primary">Matching players…</h3>
            <p className="text-sm text-white/60">{matchStatus || 'Syncing with the lobby…'}</p>
            {matchError && <p className="text-sm text-red-400">{matchError}</p>}
            <button
              type="button"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/80 hover:border-white/30"
              onClick={() => cleanupLobby({ account: accountId })}
            >
              Cancel matchmaking
            </button>
          </div>
        )}

        <button
          onClick={startGame}
          disabled={matching}
          className="w-full rounded-2xl bg-primary px-4 py-3 text-base font-semibold text-background shadow-[0_16px_30px_rgba(14,165,233,0.35)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mode === 'online'
            ? matching
              ? 'Finding Online Match…'
              : 'Find Online Match'
            : 'Play vs AI'}
        </button>

        <FlagPickerModal
          open={showFlagPicker}
          count={1}
          selected={playerFlagIndex != null ? [playerFlagIndex] : []}
          onSave={(indices) => {
            const idx = indices?.[0] ?? null;
            setPlayerFlagIndex(idx);
            try {
              if (idx != null) {
                window.localStorage?.setItem('checkersBattleRoyalPlayerFlag', FLAG_EMOJIS[idx]);
              }
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
              if (idx != null) {
                window.localStorage?.setItem(AI_FLAG_STORAGE_KEY, FLAG_EMOJIS[idx]);
              }
            } catch {}
          }}
          onClose={() => setShowAiFlagPicker(false)}
        />
      </div>
    </div>
  );
}
