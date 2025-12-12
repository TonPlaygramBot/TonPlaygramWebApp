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
    <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
      <h2 className="text-xl font-bold text-center">Chess Battle Royal Lobby</h2>
      <p className="text-center text-sm">
        Online users: {onlineCount != null ? onlineCount : 'Syncing…'}
      </p>

      <div className="space-y-2">
        <h3 className="font-semibold">Choose Mode</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: 'ai', label: 'Vs AI', desc: 'Instant practice' },
            { key: 'online', label: 'Online', desc: 'Stake & match' }
          ].map(({ key, label, desc }) => {
            const active = mode === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`rounded-xl border px-3 py-3 text-left shadow transition hover:border-primary ${
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background/70 text-text'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{label}</span>
                  {active && <span className="text-xs font-bold">Selected</span>}
                </div>
                <div className="text-xs text-subtext">{desc}</div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-subtext text-center">
          AI matches stay offline. Online mode uses your TPC stake and pairs you with another player.
        </p>
      </div>

      {mode === 'online' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Select Stake</h3>
          <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
          <p className="text-center text-subtext text-sm">
            Staking uses your TPC account{accountId ? ` #${accountId}` : ''} as escrow for every online round.
          </p>
        </div>
      )}

      {mode === 'online' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Pick Your Pieces</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'auto', label: 'Auto', desc: 'Random seats, no duplicates' },
              { key: 'white', label: 'White', desc: 'You start first' },
              { key: 'black', label: 'Black', desc: 'Opponent opens' }
            ].map(({ key, label, desc }) => {
              const active = preferredSide === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPreferredSide(key)}
                  className={`rounded-xl border px-3 py-3 text-left shadow transition hover:border-primary ${
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background/70 text-text'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{label}</span>
                    {active && <span className="text-xs font-bold">Selected</span>}
                  </div>
                  <div className="text-xs text-subtext">{desc}</div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-subtext text-center">
            Auto randomizes colors while ensuring both players get different sides.
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

      {mode === 'ai' && (
        <div className="space-y-2">
          <h3 className="font-semibold">AI Avatar Flags</h3>
          <p className="text-sm text-subtext">
            Pick the country flag for the AI rival so it matches the Snake &amp; Ladder experience.
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
      )}

      {mode === 'online' && matching && (
        <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-3 shadow">
          <h3 className="font-semibold text-primary">Matching players…</h3>
          <p className="text-sm text-subtext">{matchStatus || 'Syncing with the lobby…'}</p>
          {matchError && <p className="text-sm text-red-500">{matchError}</p>}
          <button
            type="button"
            className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm hover:border-primary"
            onClick={() => cleanupLobby({ account: accountId })}
          >
            Cancel matchmaking
          </button>
        </div>
      )}

      <button
        onClick={startGame}
        disabled={matching}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded disabled:opacity-60 disabled:cursor-not-allowed"
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
  );
}

