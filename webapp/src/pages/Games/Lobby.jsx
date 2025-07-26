import { useState, useEffect } from 'react';
import { FaUsers } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import TableSelector from '../../components/TableSelector.jsx';
import RoomSelector from '../../components/RoomSelector.jsx';
import LeaderPickerModal from '../../components/LeaderPickerModal.jsx';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import { LEADER_AVATARS } from '../../utils/leaderAvatars.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  getSnakeLobbies,
  getSnakeLobby,
  pingOnline,
  getOnlineCount,
  seatTable,
  unseatTable,
  getProfile
} from '../../utils/api.js';
import {
  getTelegramId,
  ensureAccountId,
  getPlayerId
} from '../../utils/telegram.js';
import { canStartGame } from '../../utils/lobby.js';
import { socket } from '../../utils/socket.js';

export default function Lobby() {
  const { game } = useParams();
  const navigate = useNavigate();
  useTelegramBackButton(() => navigate('/games', { replace: true }));

  useEffect(() => {
    const handler = (event, ...args) => {
      console.log('[Lobby] Socket event', event, ...args);
    };
    socket.onAny(handler);
    return () => socket.offAny(handler);
  }, []);

  useEffect(() => {
    ensureAccountId().catch(() => {});
  }, []);

  useEffect(() => {
    const handlePop = (e) => {
      e.preventDefault();
      navigate('/games', { replace: true });
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [navigate]);

  const [tables, setTables] = useState([]);
  const [table, setTable] = useState(null);
  const [stake, setStake] = useState({ token: '', amount: 0 });
  const [players, setPlayers] = useState([]);
  const [aiCount, setAiCount] = useState(0);
  const [aiType, setAiType] = useState('');
  const [showLeaderPicker, setShowLeaderPicker] = useState(false);
  const [leaders, setLeaders] = useState([]);
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [flags, setFlags] = useState([]);
  const [online, setOnline] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const selectAiType = (t) => {
    setAiType(t);
    if (t === 'leaders') {
      setShowLeaderPicker(true);
    } else if (t === 'flags') {
      setShowFlagPicker(true);
    }
    if (t !== 'leaders') setLeaders([]);
    if (t !== 'flags') setFlags([]);
  };

  useEffect(() => {
    const id = getTelegramId();
    getProfile(id)
      .then((p) => setPlayerName(p?.nickname || p?.firstName || ''))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (game === 'snake') {
      let active = true;
      function load() {
        getSnakeLobbies()
          .then((data) => {
            if (active) {
              setTables([
                { id: 'single', label: 'Single Player vs AI' },
                ...data
              ]);
              console.log('[Lobby] Loaded tables', data);
            }
          })
          .catch(() => {});
      }
      load();
      const id = setInterval(load, 5000);
      return () => {
        active = false;
        clearInterval(id);
      };
    }
  }, [game]);

  useEffect(() => {
    let id;
    let cancelled = false;
    ensureAccountId()
      .then((accountId) => {
        if (cancelled || !accountId) return;
        function ping() {
          pingOnline(accountId).catch(() => {});
          getOnlineCount()
            .then((d) => setOnline(d.count))
            .catch(() => {});
        }
        ping();
        id = setInterval(ping, 30000);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (id) clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (game === 'snake' && table && table.id !== 'single') {
      if (!stake.amount) return;
      let interval;
      let cancelled = false;
      const tableRef = `${table.id}-${stake.amount}`;
      console.log('[Lobby] seatTable interval setup', {
        tableRef,
        stake,
        player: playerName
      });
      ensureAccountId()
        .then((accountId) => {
          if (cancelled || !accountId) return;
          console.log('[Lobby] seatTable()', { tableRef, accountId });
          seatTable(accountId, tableRef, playerName).catch(() => {});
          interval = setInterval(() => {
            console.log('[Lobby] seatTable()', { tableRef, accountId });
            seatTable(accountId, tableRef, playerName).catch(() => {});
          }, 30000);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
        if (interval) clearInterval(interval);
        ensureAccountId()
          .then((accountId) => {
            if (accountId) unseatTable(accountId, tableRef).catch(() => {});
          })
          .catch(() => {});
      };
    }
  }, [game, table, playerName, stake]);

  useEffect(() => {
    if (game !== 'snake' || !table || table.id === 'single' || !stake.amount)
      return;
    const tableRef = `${table.id}-${stake.amount}`;
    const handleUnload = () => {
      ensureAccountId()
        .then((accountId) => {
          if (accountId) unseatTable(accountId, tableRef).catch(() => {});
        })
        .catch(() => {});
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [game, table, stake]);

  useEffect(() => {
    if (game === 'snake' && table && table.id !== 'single' && stake.amount) {
      const tableRef = `${table.id}-${stake.amount}`;
      let active = true;
      function loadPlayers() {
        getSnakeLobby(tableRef)
          .then((data) => {
            if (!active) return;
            const unique = [];
            const seen = new Set();
              for (const p of data.players || []) {
                const key = p.telegramId || p.id;
                if (!seen.has(key)) {
                  seen.add(key);
                  unique.push(p);
                }
              }
              setPlayers(unique);
              console.log('[Lobby] Loaded players', unique);
            })
            .catch(() => {});
      }
      loadPlayers();
      const id = setInterval(loadPlayers, 3000);
      return () => {
        active = false;
        clearInterval(id);
      };
    } else {
      setPlayers([]);
    }
  }, [game, table, stake]);

  const startGame = (flagOverride = flags, leaderOverride = leaders) => {
    if (
      table &&
      table.id !== 'single' &&
      players.length !== table.capacity
    ) {
      // Wait in the lobby until the table is full
      return;
    }
    const params = new URLSearchParams();
    if (table && stake.amount) params.set('table', `${table.id}-${stake.amount}`);
    if (table?.id === 'single') {
      localStorage.removeItem(`snakeGameState_${aiCount}`);
      params.set('ai', aiCount);
      params.set('avatars', aiType);
      if (aiType === 'leaders' && leaderOverride.length) {
        const ids = leaderOverride
          .map((l) => LEADER_AVATARS.indexOf(l))
          .filter((i) => i >= 0);
        if (ids.length) params.set('leaders', ids.join(','));
      } else if (aiType === 'flags' && flagOverride.length) {
        params.set('flags', flagOverride.join(','));
      }
    } else {
      if (stake.token) params.set('token', stake.token);
      if (stake.amount) params.set('amount', stake.amount);
    }
    navigate(`/games/${game}?${params.toString()}`);
  };

  const confirmSeat = () => {
    if (!table) return;
    if (table.id === 'single') {
      startGame();
      return;
    }
    if (!stake.amount) return;
    const tableRef = `${table.id}-${stake.amount}`;
    console.log('[Lobby] Confirm clicked', { tableRef, stake, nextConfirmed: !confirmed });
    ensureAccountId()
      .then((accountId) => {
        if (!accountId) return;
        seatTable(accountId, tableRef, playerName, !confirmed)
          .then((res) => {
            console.log('[Lobby] seatTable response', res);
            setConfirmed((c) => !c);
          })
          .catch(() => {});
      })
      .catch(() => {});
  };

  let disabled = !canStartGame(game, table, stake, aiCount, players.length);
  if (game === 'snake' && table?.id === 'single') {
    if (!aiType) disabled = true;
    if (aiType === 'leaders' && leaders.length !== aiCount) disabled = true;
    if (aiType === 'flags' && flags.length !== aiCount) disabled = true;
  }
  const allConfirmed =
    players.length === (table?.capacity || 0) &&
    players.every((p) => p.confirmed ?? true);

  useEffect(() => {
    const accountId = getPlayerId();
    const me = players.find((p) => p.id === accountId);
    if (me?.confirmed && !confirmed) setConfirmed(true);
  }, [players, confirmed]);

  useEffect(() => {
    if (game !== 'snake' || !table || table.id === 'single' || !stake.amount)
      return;
    const tableRef = `${table.id}-${stake.amount}`;
    const handler = ({ tableId }) => {
      if (tableId === tableRef) startGame();
    };
    socket.on('tableReady', handler);
    socket.on('gameStart', handler);
    return () => {
      socket.off('tableReady', handler);
      socket.off('gameStart', handler);
    };
  }, [game, table, stake, startGame]);
  // Multiplayer games require a full table before starting

  return (
    <div className="relative p-4 space-y-4 text-text">
      <img
        src="/assets/SnakeLaddersbackground.png"
        className="background-behind-board object-cover"
        alt=""
      />
      <h2 className="text-xl font-bold text-center capitalize">{game} Lobby</h2>
      <p className="text-center text-sm">Online users: {online}</p>
      {game === 'snake' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Select Table</h3>
            {table && (
              <span className="flex items-center">
                <FaUsers
                  className={`ml-2 ${players.length > 0 ? 'text-green-500' : 'text-red-500'}`}
                />
                <span className="ml-1">{players.length}</span>
              </span>
            )}
          </div>
          <TableSelector tables={tables} selected={table} onSelect={setTable} />
        </div>
      )}
      {game === 'snake' && table && (
        <div className="space-y-1">
          <h3 className="font-semibold">
            Online Players ({players.length}/{table.capacity})
          </h3>
          <ul className="text-sm list-disc list-inside">
            {players.map((p) => (
              <li key={p.telegramId || p.id}>
                {p.name}
                {p.confirmed && ' ✓'}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!(game === 'snake' && table?.id === 'single') && (
        <div className="space-y-2">
          <h3 className="font-semibold">Select Stake</h3>
          <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
        </div>
      )}
      {game === 'snake' && table?.id === 'single' && (
        <div className="space-y-2">
          <h3 className="font-semibold">How many AI opponents?</h3>
          <div className="flex gap-2">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => setAiCount(n)}
                className={`lobby-tile ${
                  aiCount === n ? 'lobby-selected' : ''
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <h3 className="font-semibold mt-2">AI Avatars</h3>
          <div className="flex gap-2">
            {['flags', 'leaders'].map((t) => (
              <button
                key={t}
                onClick={() => selectAiType(t)}
                className={`lobby-tile ${aiType === t ? 'lobby-selected' : ''}`}
              >
                {t === 'flags' ? 'Flags' : 'Leaders'}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={confirmSeat}
        disabled={disabled}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded disabled:opacity-50"
      >
        {confirmed ? (allConfirmed ? 'Starting...' : 'Unconfirm') : 'Confirm'}
      </button>
      <LeaderPickerModal
        open={showLeaderPicker}
        count={aiCount}
        selected={leaders}
        onSave={setLeaders}
        onClose={() => setShowLeaderPicker(false)}
        onComplete={(sel) => startGame(flags, sel)}
      />
      <FlagPickerModal
        open={showFlagPicker}
        count={aiCount}
        selected={flags}
        onSave={setFlags}
        onClose={() => setShowFlagPicker(false)}
        onComplete={(sel) => startGame(sel, leaders)}
      />
    </div>
  );
}
