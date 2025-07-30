import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TableSelector from '../../components/TableSelector.jsx';
import RoomSelector from '../../components/RoomSelector.jsx';
import LeaderPickerModal from '../../components/LeaderPickerModal.jsx';
import FlagPickerModal from '../../components/FlagPickerModal.jsx';
import { LEADER_AVATARS } from '../../utils/leaderAvatars.js';
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
  getSnakeLobby
} from '../../utils/api.js';
import {
  getPlayerId,
  ensureAccountId,
  getTelegramId
} from '../../utils/telegram.js';
import { canStartGame } from '../../utils/lobby.js';

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
  const [aiType, setAiType] = useState('');
  const [showLeaderPicker, setShowLeaderPicker] = useState(false);
  const [leaders, setLeaders] = useState([]);
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [flags, setFlags] = useState([]);
  const [online, setOnline] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [playerAvatar, setPlayerAvatar] = useState('');
  const [readyList, setReadyList] = useState([]);
  const [confirmed, setConfirmed] = useState(false);
  const [joinedTableId, setJoinedTableId] = useState(null);
  const startedRef = useRef(false);

  useEffect(() => {
    startedRef.current = false;
    setConfirmed(false);
    setReadyList([]);
    setJoinedTableId(null);
  }, [game, table]);

  const selectAiType = (t) => {
    setAiType(t);
    if (t === 'leaders') setShowLeaderPicker(true);
    else if (t === 'flags') setShowFlagPicker(true);
    if (t !== 'leaders') setLeaders([]);
    if (t !== 'flags') setFlags([]);
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
    if (game === 'snake') {
      setTables([
        { id: 'single', label: 'Single Player vs AI', capacity: 1 },
        { id: 'snake-2', label: 'Table 2p', capacity: 2 },
        { id: 'snake-3', label: 'Table 3p', capacity: 3 },
        { id: 'snake-4', label: 'Table 4p', capacity: 4 }
      ]);
    }
  }, [game]);

  useEffect(() => {
    if (game === 'snake' && !table && tables.length) {
      setTable(tables[0]);
    }
  }, [game, tables, table]);

  useEffect(() => {
    let cancelled = false;
    let interval;
    ensureAccountId()
      .then((playerId) => {
        if (cancelled) return;
        function ping() {
          pingOnline(playerId).catch(() => {});
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
    if (game !== 'snake' && table && table.id !== 'single') {
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
    if (game !== 'snake') {
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
      };
    }
  }, [table, stake, game, navigate, joinedTableId]);

  // Automatic game start previously triggered when all seats were filled.
  // This prevented players from selecting their preferred stake before the
  // match began. The logic has been removed so that each participant must
  // manually confirm the game start using the button below.

  const startGame = async (flagOverride = flags, leaderOverride = leaders) => {
    const params = new URLSearchParams();
    if (table) params.set('table', table.id);

    if (game === 'snake' && table?.id === 'single') {
      localStorage.removeItem(`snakeGameState_${aiCount}`);
      params.set('ai', aiCount);
      params.set('avatars', aiType);
      params.set('token', 'TPC');
      if (aiType === 'leaders' && leaderOverride.length) {
        const ids = leaderOverride
          .map((l) => LEADER_AVATARS.indexOf(l))
          .filter((i) => i >= 0);
        if (ids.length) params.set('leaders', ids.join(','));
      } else if (aiType === 'flags' && flagOverride.length) {
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
    }
    startedRef.current = true;
    navigate(`/games/${game}?${params.toString()}`);
  };

  const disabled =
    !canStartGame(game, table, stake, aiCount, players.length) ||
    (game === 'snake' && table?.id === 'single' && !aiType) ||
    (game === 'snake' &&
      table?.id === 'single' &&
      aiType === 'leaders' &&
      leaders.length !== aiCount) ||
    (game === 'snake' &&
      table?.id === 'single' &&
      aiType === 'flags' &&
      flags.length !== aiCount);

  return (
    <div className="relative p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold text-center capitalize">{game} Lobby</h2>
      <p className="text-center text-sm">Online users: {online}</p>
      {game === 'snake' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Select Table</h3>
          </div>
          <TableSelector tables={tables} selected={table} onSelect={setTable} />
        </div>
      )}
      <div className="space-y-2">
        <h3 className="font-semibold">Select Stake</h3>
        <RoomSelector selected={stake} onSelect={setStake} tokens={['TPC']} />
        <p className="text-center text-subtext text-sm">
          Staking is handled via the on-chain contract.
        </p>
      </div>
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
        onClick={startGame}
        disabled={disabled}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded disabled:opacity-50"
      >
        Start Game
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
