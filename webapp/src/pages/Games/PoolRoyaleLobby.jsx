import { useEffect, useMemo, useRef, useState } from 'react';
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
import { resolveTableSize } from '../../config/poolRoyaleTables.js';
import { socket } from '../../utils/socket.js';
import { getOnlineUsers } from '../../utils/api.js';
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
  const [readyList, setReadyList] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [matchingError, setMatchingError] = useState('');
  const [matchStatus, setMatchStatus] = useState('');
  const spinIntervalRef = useRef(null);
  const accountIdRef = useRef(null);
  const pendingTableRef = useRef('');
  const matchStartedRef = useRef(false);
  const navigateToGameRef = useRef(() => {});
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
    const isOnlineMatch = mode === 'online' && playType === 'regular';
    if (matching) return;
    cleanupRef.current?.();

    let tgId;
    let accountId;

    if (isOnlineMatch) {
      try {
        accountId = await ensureAccountId();
        const balRes = await getAccountBalance(accountId);
        if ((balRes.balance || 0) < stake.amount) {
          alert('Insufficient balance');
          return;
        }
        tgId = getTelegramId();
        await addTransaction(tgId, -stake.amount, 'stake', {
          game: 'poolroyale-online',
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

    accountIdRef.current = accountId;

    if (isOnlineMatch) {
      setMatchingError('');
      setMatchStatus('Connecting to lobby…');
      setMatching(true);
      setIsSearching(true);
      if (!accountId) {
        setIsSearching(false);
        setMatchingError('Unable to resolve your TPC account.');
        setMatching(false);
        return;
      }

      const navigateToGame = ({ tableId: startedId, players: list = [] } = {}) => {
        if (!startedId || matchStartedRef.current) return;
        matchStartedRef.current = true;
        cleanupRef.current?.({ account: accountId, skipRefReset: true });
        const friendlyName =
          list.find((p) => String(p.id) === String(accountId))?.name ||
          getTelegramFirstName() ||
          getTelegramId() ||
          `TPC ${accountId}`;
        const opponent = list.find((p) => String(p.id) !== String(accountId));

        const params = new URLSearchParams();
        params.set('variant', variant);
        params.set('type', playType);
        params.set('mode', 'online');
        params.set('tableId', startedId);
        if (stake.token) params.set('token', stake.token);
        if (stake.amount) params.set('amount', stake.amount);
        if (avatar) params.set('avatar', avatar);
        const tgId = getTelegramId();
        if (tgId) params.set('tgId', tgId);
        const resolvedAccountId = accountIdRef.current;
        if (resolvedAccountId) params.set('accountId', resolvedAccountId);
        if (tableSize) params.set('tableSize', tableSize);
        if (friendlyName) params.set('name', friendlyName);
        if (opponent?.name) params.set('opponent', opponent.name);
        if (opponent?.avatar) params.set('opponentAvatar', opponent.avatar);
        navigate(`/games/poolroyale?${params.toString()}`);
      };

      navigateToGameRef.current = navigateToGame;

      const handleLobbyUpdate = ({ tableId: tid, players: list = [], ready = [] } = {}) => {
        if (!tid || tid !== pendingTableRef.current) return;
        setMatchPlayers(list);
        setReadyList(ready);
        const others = list.filter((p) => String(p.id) !== String(accountId));
        setMatchStatus(
          others.length > 0 ? 'Opponent joined. Locking seats…' : 'Waiting for another player…'
        );
      };

      const handleGameStart = ({ tableId: startedId, players: list = [] } = {}) => {
        if (!startedId || startedId !== pendingTableRef.current) return;
        navigateToGame({ tableId: startedId, players: list });
      };

      const cleanupLobby = ({ account, skipRefReset } = {}) => {
        socket.off('lobbyUpdate', handleLobbyUpdate);
        socket.off('gameStart', handleGameStart);
        const leavingAccount = account || accountIdRef.current;
        if (pendingTableRef.current && leavingAccount) {
          socket.emit('leaveLobby', { accountId: leavingAccount, tableId: pendingTableRef.current });
        }
        pendingTableRef.current = '';
        if (spinIntervalRef.current) {
          clearInterval(spinIntervalRef.current);
          spinIntervalRef.current = null;
        }
        setMatchPlayers([]);
        setReadyList([]);
        setMatchStatus('');
        setMatching(false);
        setSpinningPlayer('');
        setIsSearching(false);
        setMatchingError('');
        matchStartedRef.current = false;
        if (!skipRefReset) cleanupRef.current = () => {};
      };

      cleanupRef.current = cleanupLobby;

      socket.on('lobbyUpdate', handleLobbyUpdate);
      socket.on('gameStart', handleGameStart);
      socket.emit('register', { playerId: accountId });

      socket.emit(
        'seatTable',
        {
          accountId,
          stake: stake.amount,
          token: stake.token,
          gameType: 'poolroyale',
          mode,
          variant,
          tableSize,
          playType,
          playerName: getTelegramFirstName() || `TPC ${accountId}`,
          avatar
        },
        (res) => {
          setIsSearching(false);
          if (!res?.success || !res.tableId) {
            setMatchingError(
              res?.message || 'Failed to join the online arena. Please retry.'
            );
            cleanupLobby({ account: accountId });
            return;
          }
          pendingTableRef.current = res.tableId;
          setMatchStatus('Waiting for another player…');
          setMatchPlayers(res.players || []);
          setReadyList(res.ready || []);
          socket.emit('confirmReady', {
            accountId,
            tableId: res.tableId
          });
        }
      );
      return;
    }

    const params = new URLSearchParams();
    params.set('variant', variant);
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
  }, [playType]);

  useEffect(() => {
    if (mode !== 'online' || playType !== 'regular') {
      cleanupRef.current?.();
      setMatching(false);
      setMatchStatus('');
      setMatchPlayers([]);
      setReadyList([]);
      setIsSearching(false);
      matchStartedRef.current = false;
    }
  }, [mode, playType]);

  const readyIds = useMemo(
    () => new Set((readyList || []).map((id) => String(id))),
    [readyList]
  );

  useEffect(() => {
    if (!matching || matchStartedRef.current) return;
    const tableId = pendingTableRef.current;
    const myId = accountIdRef.current;
    if (!tableId || !myId) return;
    const readySet = new Set((readyList || []).map((id) => String(id)));
    if (!readySet.has(String(myId))) return;
    const opponent = (matchPlayers || []).find((p) => {
      const pid = String(p?.id ?? '');
      return pid && pid !== String(myId) && readySet.has(pid);
    });
    if (!opponent) return;
    const readyPlayers = (matchPlayers || []).filter((p) =>
      readySet.has(String(p?.id ?? ''))
    );
    navigateToGameRef.current({ tableId, players: readyPlayers });
  }, [matching, matchPlayers, readyList]);

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
        <h3 className="font-semibold">Mode</h3>
        <div className="flex gap-2">
          {[
            { id: 'ai', label: 'Vs AI' },
            { id: 'online', label: '1v1 Online', disabled: playType === 'tournament' }
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
                  Tournament bracket only
                </span>
              )}
            </div>
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
