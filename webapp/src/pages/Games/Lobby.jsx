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

  useEffect(() => {
    const current = joinedTableId;
    return () => {
      if (current) {
        const id = getPlayerId();
        socket.emit('leaveLobby', { accountId: id, tableId: current });
      }
    };
  }, [joinedTableId]);

  const selectAiType = (t) => {
    setAiType(t);
    if (t === 'flags') setShowFlagPicker(true);
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
    const updatePhoto = () => {
      const saved = loadAvatar();
      setPlayerAvatar(saved || getTelegramPhotoUrl());
    };
    window.addEventListener('profilePhotoUpdated', updatePhoto);
    return () => window.removeEventListener('profilePhotoUpdated', updatePhoto);
  }, []);

  useEffect(() => {
    if (game === 'snake') {
      setTables([
        { id: 'single', label: 'Single Player vs AI', capacity: 1 },
        { id: 'snake-2', label: 'Table 2 Players', capacity: 2 },
        { id: 'snake-3', label: 'Table 3 Players', capacity: 3 },
        { id: 'snake-4', label: 'Table 4 Players', capacity: 4 }
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
  }, [table, stake, game, navigate, joinedTableId, confirmed]);

  // Automatic game start previously triggered when all seats were filled.
  // This prevented players from selecting their preferred stake before the
  // match began. The logic has been removed so that each participant must
  // manually confirm the game start using the button below.

  const startGame = async (flagOverride = flags) => {
    const params = new URLSearchParams();
    if (table) params.set('table', table.id);

    if (game === 'snake' && table && table.id !== 'single') {
      const accountId = await ensureAccountId().catch(() => null);
      if (!accountId) return;
      socket.emit(
        'seatTable',
        {
          accountId,
          gameType: 'snake',
          stake: stake.amount,
          maxPlayers: table.capacity,
          playerName,
          tableId: table.id,
          avatar: playerAvatar,
        },
        (res) => {
          if (res && res.success) {
            setPlayers(res.players || []);
            setCurrentTurn(res.currentTurn);
            setReadyList(res.ready || []);
            setJoinedTableId(res.tableId);
            socket.emit('confirmReady', { accountId, tableId: res.tableId });
            setConfirmed(true);
          }
        }
      );
      return;
    } else if (game === 'snake' && table?.id === 'single') {
      localStorage.removeItem(`snakeGameState_${aiCount}`);
      params.set('ai', aiCount);
      params.set('avatars', aiType);
      params.set('token', 'TPC');
      if (aiType === 'flags' && flagOverride.length) {
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
    !stake || !stake.token || !stake.amount ||
    (game === 'snake' && table?.id === 'single' && !aiType) ||
    (game === 'snake' &&
      table?.id === 'single' &&
      aiType === 'flags' &&
      flags.length !== aiCount);

  return (
    <div className="relative p-4 space-y-4 text-text min-h-screen game-page-bg">
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
            {['flags'].map((t) => (
              <button
                key={t}
                onClick={() => selectAiType(t)}
                className={`lobby-tile ${aiType === t ? 'lobby-selected' : ''}`}
              >
                Flags
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={startGame}
        disabled={disabled || (game === 'snake' && table?.id !== 'single' && confirmed)}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded disabled:opacity-50"
      >
        {game === 'snake' && table?.id !== 'single' ? (confirmed ? 'Waiting…' : 'Confirm') : 'Start Game'}
      </button>
      <FlagPickerModal
        open={showFlagPicker}
        count={aiCount}
        selected={flags}
        onSave={setFlags}
        onClose={() => setShowFlagPicker(false)}
        onComplete={(sel) => startGame(sel)}
      />
    </div>
  );
}
