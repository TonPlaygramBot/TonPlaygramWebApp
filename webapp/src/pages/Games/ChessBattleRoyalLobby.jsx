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

const DEV_ACCOUNT = import.meta.env.VITE_DEV_ACCOUNT_ID;
const DEV_ACCOUNT_1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
const DEV_ACCOUNT_2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;
const AI_FLAG_STORAGE_KEY = 'chessBattleRoyalAiFlag';

export default function ChessBattleRoyalLobby() {
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
  const pendingTableRef = useRef('');
  const cleanupRef = useRef(() => {});

  const selectedFlag = playerFlagIndex != null ? FLAG_EMOJIS[playerFlagIndex] : '';
  const selectedAiFlag = aiFlagIndex != null ? FLAG_EMOJIS[aiFlagIndex] : '';

  useEffect(() => {
    import('./ChessBattleRoyal.jsx').catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const saved = loadAvatar();
      setAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage?.getItem('chessBattleRoyalPlayerFlag');
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

    navigate(`/games/chessbattleroyal?${params.toString()}`);
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
          game: 'chessbattle',
          players: 2,
          accountId: trackedAccountId,
        });
      } catch {}
    }

    if (!isOnline) {
      navigateToGame({ tgId, trackedAccountId });
      return;
    }

    setMatchError('');
    setMatching(true);
    setMatchStatus('Connecting to lobby…');

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
    socket.emit('register', { playerId: trackedAccountId || accountId });

    const friendlyName = getTelegramFirstName() || getTelegramUsername() || 'Player';
    socket.emit(
      'seatTable',
      {
        accountId: trackedAccountId || accountId,
        gameType: 'chess',
        stake: stake.amount ?? 0,
        maxPlayers: 2,
        playerName: friendlyName,
        avatar,
        preferredSide
      },
      (res) => {
        if (!res?.success || !res.tableId) {
          setMatchError('Could not join the online lobby. Please try again.');
          cleanupLobby({ account: trackedAccountId });
          return;
        }
        pendingTableRef.current = res.tableId;
        setMatchStatus('Waiting for another player…');
        socket.emit('confirmReady', {
          accountId: trackedAccountId || accountId,
          tableId: res.tableId
        });
      }
    );
  };

  return (
    <div className="relative min-h-screen bg-[#070b16] text-text">
      <div className="absolute inset-0 tetris-grid-bg opacity-60" />
      <div className="relative z-10 space-y-4 p-4 pb-8">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#111827]/90 via-[#0f172a]/80 to-[#0b1324]/90 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-sky-200/70">
                Chess Battle Royal
              </p>
              <h2 className="text-2xl font-bold text-white">Modern Lobby</h2>
            </div>
            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80">
              {onlineCount != null ? `${onlineCount} online` : 'Syncing…'}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1f2937]/90 to-[#0f172a]/90 p-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-400/40 via-sky-400/20 to-indigo-500/40 p-[1px]">
                  <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-2xl">
                    ♟️
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Battle Queue</p>
                  <p className="text-xs text-white/60">
                    Prep your pieces while the arena loads in the background.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Instant start</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Mobile ready</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">HDR arena</span>
              </div>
            </div>
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
                  <p className="text-xs text-white/50">
                    Flag: {selectedFlag || 'Auto'}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-white/60">
                Your lobby choices persist into the match start screen.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Choose Mode</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Queue</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                key: 'ai',
                label: 'Vs AI',
                desc: 'Instant practice',
                accent: 'from-emerald-400/30 via-emerald-500/10 to-transparent',
                icon: '🤖'
              },
              {
                key: 'online',
                label: 'Online',
                desc: 'Stake & match',
                accent: 'from-indigo-400/30 via-sky-500/10 to-transparent',
                icon: '⚔️'
              }
            ].map(({ key, label, desc, accent, icon }) => {
              const active = mode === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  className={`group flex items-center gap-3 rounded-2xl border px-4 py-4 text-left shadow transition ${
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-white/10 bg-black/30 text-white/80 hover:border-white/30'
                  }`}
                >
                  <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${accent} p-[1px]`}>
                    <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-2xl">
                      {icon}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-semibold">{label}</span>
                      {active && <span className="text-[10px] font-bold uppercase">Selected</span>}
                    </div>
                    <div className="text-xs text-white/60">{desc}</div>
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Pick Your Pieces</h3>
              <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Sides</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Your Flag & Avatar</h3>
            <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Identity</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <button
              type="button"
              onClick={() => setShowFlagPicker(true)}
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left text-sm text-white/80 transition hover:border-white/30"
            >
              <div className="text-[10px] uppercase tracking-[0.35em] text-white/60">Flag</div>
              <div className="mt-2 flex items-center gap-2 text-base font-semibold">
                <span className="text-lg">{selectedFlag || '🌐'}</span>
                <span>{selectedFlag ? 'Custom flag' : 'Auto-detect & save'}</span>
              </div>
            </button>
            {avatar && (
              <div className="mt-3 flex items-center gap-3">
                <img
                  src={avatar}
                  alt="Your avatar"
                  className="h-12 w-12 rounded-full border border-white/20 object-cover"
                />
                <div className="text-sm text-white/60">Your avatar will appear in the match intro.</div>
              </div>
            )}
          </div>
        </div>

        {mode === 'ai' && (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-400/40 to-indigo-500/40 p-[1px]">
                <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-xl">
                  🤝
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-white">AI Avatar Flags</h3>
                <p className="text-xs text-white/60">
                  Pick the country flag for the AI rival so it matches the Snake &amp; Ladder experience.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAiFlagPicker(true)}
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left text-sm text-white/80 transition hover:border-white/30"
            >
              <div className="text-[10px] uppercase tracking-[0.35em] text-white/60">AI Flag</div>
              <div className="mt-2 flex items-center gap-2 text-base font-semibold">
                <span className="text-lg">{selectedAiFlag || '🌐'}</span>
                <span>{selectedAiFlag ? 'Custom AI flag' : 'Auto-pick for opponent'}</span>
              </div>
            </button>
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
                window.localStorage?.setItem('chessBattleRoyalPlayerFlag', FLAG_EMOJIS[idx]);
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
