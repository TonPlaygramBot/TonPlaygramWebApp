import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TableSelector from '../../components/TableSelector.jsx';
import RoomSelector from '../../components/RoomSelector.jsx';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { socket } from '../../utils/socket.js';
import { loadAvatar, getAvatarUrl } from '../../utils/avatarUtils.js';
import { getTelegramPhotoUrl } from '../../utils/telegram.js';
import {
  pingOnline,
  getOnlineCount,
  getProfile,
  getAccountBalance,
  addTransaction,
  getSnakeLobby,
  getSnakeLobbies
} from '../../utils/api.js';
import {
  getPlayerId,
  ensureAccountId,
  getTelegramId
} from '../../utils/telegram.js';
import { canStartGame } from '../../utils/lobby.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { runSnakeOnlineFlow } from './snakeOnlineFlow.js';
import OptionIcon from '../../components/OptionIcon.jsx';
import { getLobbyIcon } from '../../config/gameAssets.js';
import GameLobbyHeader from '../../components/GameLobbyHeader.jsx';

export default function Lobby() {
  const { game } = useParams();
  const navigate = useNavigate();
  useTelegramBackButton();

  useEffect(() => {
    ensureAccountId().catch(() => {});
  }, []);

  const [tables, setTables] = useState([]);
  const [table, setTable] = useState(null);
  const [stake, setStake] = useState({ token: '', amount: 0 });
  const [players, setPlayers] = useState([]);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [aiCount, setAiCount] = useState(0);
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [flags, setFlags] = useState([]);
  const [playerFlag, setPlayerFlag] = useState([]);
  const [flagPickerMode, setFlagPickerMode] = useState('ai');
  const [online, setOnline] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [playerAvatar, setPlayerAvatar] = useState('');
  const [readyList, setReadyList] = useState([]);
  const [confirmed, setConfirmed] = useState(false);
  const [joinedTableId, setJoinedTableId] = useState(null);
  const [joinedCapacity, setJoinedCapacity] = useState(null);
  const [matching, setMatching] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [matchStatus, setMatchStatus] = useState('');
  const [matchingError, setMatchingError] = useState('');
  const startedRef = useRef(false);
  const accountIdRef = useRef(null);
  const pendingTableRef = useRef('');
  const cleanupRef = useRef(() => {});
  const stakeDebitRef = useRef(null);
  const matchTimeoutRef = useRef(null);
  const seatTimeoutRef = useRef(null);

  useEffect(() => {
    cleanupRef.current?.({ keepError: true });
    startedRef.current = false;
    setConfirmed(false);
    setReadyList([]);
    setJoinedTableId(null);
    setJoinedCapacity(null);
    setMatching(false);
    setMatchStatus('');
    setMatchingError('');
    setIsSearching(false);
    setPlayers([]);
    setCurrentTurn(null);
  }, [game, table]);

  useEffect(() => {
    const current = joinedTableId;
    return () => {
      if (current) {
        const id = getPlayerId();
        socket.emit('leaveLobby', { accountId: id, tableId: current });
      }
      cleanupRef.current?.({ keepError: true });
    };
  }, [joinedTableId]);

  const openAiFlagPicker = () => {
    if (!aiCount) setAiCount(1);
    setFlagPickerMode('ai');
    setShowFlagPicker(true);
  };

  const openPlayerFlagPicker = () => {
    setFlagPickerMode('player');
    setShowFlagPicker(true);
  };

  useEffect(() => {
    try {
      const aid = getPlayerId();
      setPlayerName(String(aid));
      const saved = loadAvatar();
      setPlayerAvatar(saved || getTelegramPhotoUrl());
    } catch {}
  }, []);

  useEffect(() => {
    const updatePhoto = () => {
      const saved = loadAvatar();
      setPlayerAvatar(saved || getTelegramPhotoUrl());
    };
    window.addEventListener('profilePhotoUpdated', updatePhoto);
    return () => window.removeEventListener('profilePhotoUpdated', updatePhoto);
  }, []);

  useEffect(() => {
    if (game !== 'snake') return undefined;
    let cancelled = false;
    const singleTable = {
      id: 'single',
      label: '1 Player',
      capacity: 1,
      icon: getLobbyIcon('domino-royal', 'players-1'),
      iconFallback: '👤',
      subtitle: null
    };

    const applyTables = (lobbies = []) => {
      if (cancelled) return;
      const multiplayer = lobbies
        .map((entry) => ({
          id: entry.id,
          label: `${entry.capacity} Players`,
          capacity: entry.capacity,
          players: entry.players || 0,
          icon: getLobbyIcon('domino-royal', `players-${entry.capacity}`),
          iconFallback: '👥',
          subtitle: null
        }))
        .sort((a, b) => a.capacity - b.capacity);
      const nextTables = [singleTable, ...multiplayer];
      setTables(nextTables);
      setTable((current) => {
        if (!nextTables.length) return null;
        if (!current) return nextTables[0];
        const stillExists = nextTables.some((t) => t.id === current.id);
        return stillExists ? current : nextTables[0];
      });
    };

    const fetchTables = () => {
      getSnakeLobbies()
        .then((list) => applyTables(Array.isArray(list) ? list : []))
        .catch(() => {
          applyTables([
            { id: 'snake-2', capacity: 2, players: 0 },
            { id: 'snake-3', capacity: 3, players: 0 },
            { id: 'snake-4', capacity: 4, players: 0 }
          ]);
        });
    };

    fetchTables();
    const interval = setInterval(fetchTables, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [game]);

  useEffect(() => {
    if (game === 'snake' && !table && tables.length) {
      setTable(tables[0]);
    }
  }, [game, tables, table]);

  useEffect(() => {
    if (game !== 'snake') return;
    import('./SnakeAndLadder.jsx').catch(() => {});
  }, [game]);

  useEffect(() => {
    let cancelled = false;
    let interval;
    ensureAccountId()
      .then((playerId) => {
        if (cancelled) return;
        function ping() {
          const status = localStorage.getItem('onlineStatus') || 'online';
          pingOnline(playerId, status).catch(() => {});
          getOnlineCount()
            .then((d) => setOnline(d.count))
            .catch(() => {});
        }
        ping();
        interval = setInterval(ping, 30000);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, []);


  useEffect(() => {
    if (table && table.id !== 'single') {
      let active = true;
      getSnakeLobby(table.id)
        .then((data) => {
          if (!active) return;
          setPlayers(data.players || []);
          if (data.currentTurn != null) setCurrentTurn(data.currentTurn);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }
  }, [game, table]);

  useEffect(() => {
    const onUpdate = ({ tableId, players: list, currentTurn, ready }) => {
      console.log('lobbyUpdate', tableId, list);
      const idToMatch = joinedTableId || table?.id;
      if (idToMatch && tableId === idToMatch) {
        setPlayers(list);
        if (currentTurn != null) setCurrentTurn(currentTurn);
        if (Array.isArray(ready)) setReadyList(ready);
      }
    };
    const onStart = ({ tableId }) => {
      console.log('gameStart', tableId);
      const idToMatch = joinedTableId || table?.id;
      if (
        idToMatch &&
        tableId === idToMatch &&
        confirmed &&
        !startedRef.current
      ) {
        const params = new URLSearchParams();
        params.set('table', idToMatch);
        const cap = joinedCapacity || table?.capacity;
        if (cap) params.set('capacity', String(cap));
        if (stake.token) params.set('token', stake.token);
        if (stake.amount) params.set('amount', stake.amount);
        startedRef.current = true;
        navigate(`/games/${game}?${params.toString()}`);
      }
    };
    socket.on('lobbyUpdate', onUpdate);
    socket.on('gameStart', onStart);
    return () => {
      socket.off('lobbyUpdate', onUpdate);
      socket.off('gameStart', onStart);
      cleanupRef.current?.({ keepError: true });
    };
  }, [table, stake, game, navigate, joinedTableId, joinedCapacity, confirmed]);

  useEffect(() => {
    if (game !== 'snake' || !table || table.id === 'single') return;
    setTables((prev) =>
      prev.map((t) =>
        t.id === table.id
          ? {
              ...t,
              players: players.length
            }
          : t
      )
    );
  }, [players, game, table]);

  // Automatic game start previously triggered when all seats were filled.
  // This prevented players from selecting their preferred stake before the
  // match began. The logic has been removed so that each participant must
  // manually confirm the game start using the button below.

  const startGame = async (flagOverride = flags) => {
    const params = new URLSearchParams();
    if (table) {
      params.set('table', table.id);
      if (table.capacity) params.set('capacity', String(table.capacity));
    }

    if (game === 'snake' && table && table.id !== 'single') {
      if (matching || isSearching) return;
      await cleanupRef.current?.({ keepError: true });
      const handleGameStart = ({ tableId: startedId, maxPlayers, currentTurn }) => {
        if (startedRef.current) return;
        startedRef.current = true;
        const params = new URLSearchParams();
        const finalTableId = startedId || table.id;
        if (finalTableId) params.set('table', finalTableId);
        const cap = joinedCapacity || maxPlayers || table?.capacity;
        if (cap) params.set('capacity', String(cap));
        if (stake.token) params.set('token', stake.token);
        if (stake.amount) params.set('amount', stake.amount);
        navigate(`/games/${game}?${params.toString()}`);
      };

      await runSnakeOnlineFlow({
        table,
        stake,
        playerName,
        playerAvatar,
        deps: { ensureAccountId, getAccountBalance, addTransaction, getTelegramId },
        state: {
          setMatchStatus,
          setMatchingError,
          setMatching,
          setIsSearching,
          setPlayers,
          setCurrentTurn,
          setReadyList,
          setConfirmed,
          setJoinedTableId,
          setJoinedCapacity
        },
        refs: {
          accountIdRef,
          pendingTableRef,
          cleanupRef,
          stakeDebitRef,
          matchTimeoutRef,
          seatTimeoutRef
        },
        onGameStart: handleGameStart
      });
      return;
    } else if (game === 'snake' && table?.id === 'single') {
      localStorage.removeItem(`snakeGameState_${aiCount}`);
      params.set('ai', aiCount);
      params.set('token', 'TPC');
      if (flagOverride.length) {
        params.set('flags', flagOverride.join(','));
      }
      if (stake.amount) params.set('amount', stake.amount);
      try {
        const accountId = await ensureAccountId();
        const balRes = await getAccountBalance(accountId);
        if ((balRes.balance || 0) < stake.amount) {
          alert('Insufficient balance');
          return;
        }
        const tgId = getTelegramId();
        await addTransaction(tgId, -stake.amount, 'stake', {
          game: 'snake-ai',
          players: aiCount + 1
        });
      } catch {}
    } else {
      if (stake.token) params.set('token', stake.token);
      if (stake.amount) params.set('amount', stake.amount);
    }

    if (game === 'snake' && table && table.id !== 'single') {
      params.set('table', table.id);
      if (table.capacity) params.set('capacity', String(table.capacity));
    }
    const aiFlagSelection = flagOverride && flagOverride.length ? flagOverride : flags;
    if (aiFlagSelection.length && !(game === 'snake' && table?.id === 'single')) {
      params.set('aiFlags', aiFlagSelection.join(','));
    }
    startedRef.current = true;
    navigate(`/games/${game}?${params.toString()}`);
  };

  const disabled =
    !stake || !stake.token || !stake.amount ||
    (game === 'snake' && table?.id === 'single' && !aiCount) ||
    matching ||
    isSearching;

  const aiFlagPickerCount = game === 'snake' && table?.id === 'single'
    ? Math.max(aiCount || 1, 1)
    : Math.max(aiCount || 1, 1);
  const flagPickerCount = flagPickerMode === 'player' ? 1 : aiFlagPickerCount;

  const readyIds = new Set(readyList.map((id) => String(id)));

  if (game === 'snake') {
    return (
      <div className="relative min-h-screen bg-[#070b16] text-text">
        <div className="absolute inset-0 tetris-grid-bg opacity-60" />
        <div className="relative z-10 space-y-4 p-4 pb-8">
          <GameLobbyHeader
            slug="snake"
            title="Snake & Ladder Lobby"
            badge={online != null ? `${online} online` : 'Syncing…'}
          />

          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#101828]/80 to-[#0b1324]/90 p-4">
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Identity</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-full border border-white/15 bg-white/5">
                {playerAvatar ? (
                  <img src={playerAvatar} alt="Your avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg">🙂</div>
                )}
              </div>
              <div className="text-sm text-white/80">
                <p className="font-semibold">{playerName || 'Player'} ready</p>
                <p className="text-xs text-white/50">
                  Player flag: {playerFlag.length ? FLAG_EMOJIS[playerFlag[0]] : 'Auto'} • AI flags:{' '}
                  {flags.length ? flags.map((f) => FLAG_EMOJIS[f] || '').join(' ') : 'Auto'}
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                onClick={openPlayerFlagPicker}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80 transition hover:border-white/30"
              >
                <div className="text-[11px] uppercase tracking-wide text-white/50">Player Flag</div>
                <div className="flex items-center gap-2 text-base font-semibold">
                  <span className="text-lg">{playerFlag.length ? FLAG_EMOJIS[playerFlag[0]] : '🌐'}</span>
                  <span>{playerFlag.length ? 'Custom flag' : 'Auto-detect & save'}</span>
                </div>
              </button>
              {table?.id === 'single' && (
                <button
                  type="button"
                  onClick={openAiFlagPicker}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80 transition hover:border-white/30"
                >
                  <div className="text-[11px] uppercase tracking-wide text-white/50">AI Flags</div>
                  <div className="flex items-center gap-2 text-base font-semibold">
                    <span className="text-lg">
                      {flags.length ? flags.map((f) => FLAG_EMOJIS[f] || '').join(' ') : '🌐'}
                    </span>
                    <span>{flags.length ? 'Custom AI flags' : 'Auto-pick each match'}</span>
                  </div>
                </button>
              )}
            </div>
            <p className="mt-3 text-xs text-white/60">Your lobby picks will carry into the match intro.</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Vs how many players</h3>
              <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Queue</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
              <TableSelector tables={tables} selected={table} onSelect={setTable} />
            </div>
          </div>

          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-yellow-400/40 to-orange-500/40 p-[1px]">
                <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#0b1220] text-xl">
                  💰
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-white">Select Stake</h3>
                <p className="text-xs text-white/60">Stake your TPC to reserve the board.</p>
              </div>
            </div>
            <div className="mt-3">
              <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
            </div>
            <p className="text-center text-white/60 text-xs">
              Staking uses your TPC account as escrow for each match.
            </p>
          </div>

          {table?.id === 'single' && (
            <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">AI Opponents</h3>
                <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Solo</span>
              </div>
              <p className="text-xs text-white/60">
                Choose how many AI rivals join your board. Flags auto-pick each match.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => setAiCount(n)}
                    className={`lobby-option-card ${
                      aiCount === n ? 'lobby-option-card-active' : 'lobby-option-card-inactive'
                    }`}
                  >
                    <div className="lobby-option-thumb bg-gradient-to-br from-emerald-400/30 via-sky-500/10 to-transparent">
                      <div className="lobby-option-thumb-inner">
                        <OptionIcon
                          src={getLobbyIcon('domino-royal', `players-${n + 1}`)}
                          alt={`${n + 1} players`}
                          fallback="👥"
                          className="lobby-option-icon"
                        />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="lobby-option-label">{n} AI</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {table?.id !== 'single' && (
            <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Players in Lobby</h3>
                <span className="text-[11px] uppercase tracking-[0.3em] text-white/40">Multiplayer</span>
              </div>
              <div className="space-y-2">
                {players.length === 0 && (
                  <p className="text-sm text-white/60 text-center">Waiting for players to join…</p>
                )}
                {players.map((p, index) => {
                  const avatarSrc = getAvatarUrl(p.avatar);
                  const isReady = readyIds.has(String(p.id));
                  const isTurn = currentTurn != null && String(currentTurn) === String(p.id);
                  return (
                    <div
                      key={`${p.id}-${index}`}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-3 py-2 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-sm font-semibold text-white/80">
                          {avatarSrc ? (
                            <img
                              src={avatarSrc}
                              alt={p.name || `Player ${index + 1}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            String(p.name || '?').charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold leading-tight text-white">{p.name || `Player ${index + 1}`}</p>
                          <p className="text-xs text-white/50 leading-tight">ID: {p.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {isTurn && <span className="text-xs font-semibold text-primary">Rolling next</span>}
                        <span
                          className={`text-xs font-semibold ${
                            isReady ? 'text-emerald-400' : 'text-white/60'
                          }`}
                        >
                          {isReady ? 'Ready' : 'Waiting'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={startGame}
            disabled={disabled || (table?.id !== 'single' && confirmed)}
            className="w-full rounded-2xl bg-primary px-4 py-3 text-base font-semibold text-background shadow-[0_16px_30px_rgba(14,165,233,0.35)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {table?.id !== 'single' ? (confirmed ? 'Waiting…' : 'Confirm') : 'Start Game'}
          </button>

          {(matchStatus || matchingError) && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center text-sm text-white/70">
              <span className={matchingError ? 'text-red-400' : ''}>
                {matchingError || matchStatus}
              </span>
            </div>
          )}

          <FlagPickerModal
            open={showFlagPicker}
            count={flagPickerCount}
            selected={flagPickerMode === 'player' ? playerFlag : flags}
            onSave={flagPickerMode === 'player' ? setPlayerFlag : setFlags}
            onClose={() => setShowFlagPicker(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen tetris-grid-bg">
      <h2 className="text-xl font-bold text-center capitalize">{game} Lobby</h2>
      <p className="text-center text-sm">Online users: {online}</p>
      <div className="space-y-2">
        <h3 className="font-semibold">Select Stake</h3>
        <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
        <p className="text-center text-subtext text-sm">
          Staking is handled via the on-chain contract.
        </p>
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold">AI Avatar Flags</h3>
        <p className="text-sm text-subtext text-center">
          Match the Snake &amp; Ladder lobby by picking worldwide flags for AI opponents.
        </p>
        <button
          type="button"
          onClick={openAiFlagPicker}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background/60 hover:border-primary text-sm text-left"
        >
          <div className="text-[11px] uppercase tracking-wide text-subtext">AI Flags</div>
          <div className="flex items-center gap-2 text-base font-semibold">
            <span className="text-lg">
              {flags.length ? flags.map((f) => FLAG_EMOJIS[f] || '').join(' ') : '🌐'}
            </span>
            <span>{flags.length ? 'Custom AI avatars' : 'Auto-pick from global flags'}</span>
          </div>
        </button>
      </div>
      <button
        onClick={startGame}
        disabled={disabled || confirmed}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded disabled:opacity-50"
      >
        Start Game
      </button>
      {(matchStatus || matchingError) && (
        <p className={`text-sm text-center ${matchingError ? 'text-red-400' : 'text-subtext'}`}>
          {matchingError || matchStatus}
        </p>
      )}
      <FlagPickerModal
        open={showFlagPicker}
        count={flagPickerCount}
        selected={flags}
        onSave={setFlags}
        onClose={() => setShowFlagPicker(false)}
        onComplete={(sel) => startGame(sel)}
      />
    </div>
  );
}
