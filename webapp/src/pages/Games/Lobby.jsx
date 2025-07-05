import { useState, useEffect } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { FaUsers } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import TableSelector from '../../components/TableSelector.jsx';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  getSnakeLobbies,
  getSnakeLobby,
  pingOnline,
  getOnlineCount,
  seatTable,
  unseatTable,
  getProfile,
  getAccountBalance,
  addTransaction,
} from '../../utils/api.js';
import { getPlayerId, ensureAccountId, getTelegramId } from '../../utils/telegram.js';
import { canStartGame } from '../../utils/lobby.js';
import { SNAKE_CONTRACT_ADDRESS } from '../../utils/constants.js';

export default function Lobby() {
  const { game } = useParams();
  const navigate = useNavigate();
  const walletAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  useTelegramBackButton(() => navigate('/games', { replace: true }));

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
  const [online, setOnline] = useState(0);
  const [playerName, setPlayerName] = useState('');

  useEffect(() => {
    try {
      const aid = getPlayerId();
      setPlayerName(String(aid));
    } catch {}
  }, []);

  useEffect(() => {
    if (game === 'snake') {
      let active = true;
      function load() {
        getSnakeLobbies()
          .then((data) => {
            if (active) setTables([{ id: 'single', label: 'Single Player vs AI' }, ...data]);
          })
          .catch(() => {});
      }
      load();
      const id = setInterval(load, 5000);
      return () => {
        active = false;
        clearInterval(id);
      };
    } else if (game === 'domino') {
      const dominoTables = [
        { id: 'single', label: 'Single Player vs AI' },
        { id: '2p', capacity: 2, players: 0 },
        { id: '3p', capacity: 3, players: 0 },
        { id: '4p', capacity: 4, players: 0 },
      ];
      setTables(dominoTables);
      setTable(dominoTables[0]);
    }
  }, [game]);

  useEffect(() => {
    const playerId = getPlayerId();
    function ping() {
      pingOnline(playerId).catch(() => {});
      getOnlineCount()
        .then((d) => setOnline(d.count))
        .catch(() => {});
    }
    ping();
    const id = setInterval(ping, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (game === 'snake' && table && table.id !== 'single') {
      const playerId = getPlayerId();
      seatTable(playerId, table.id, playerName).catch(() => {});
      const id = setInterval(() => {
        seatTable(playerId, table.id, playerName).catch(() => {});
      }, 30000);
      return () => {
        clearInterval(id);
        unseatTable(playerId, table.id).catch(() => {});
      };
    }
  }, [game, table, playerName]);

  useEffect(() => {
    if (game === 'snake' && table && table.id !== 'single') {
      let active = true;
      function loadPlayers() {
        getSnakeLobby(table.id)
          .then((data) => {
            if (active) setPlayers(data.players);
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
  }, [game, table]);


  const startGame = async () => {
    const params = new URLSearchParams();
    if (table) params.set('table', table.id);
    if (game === 'snake' && stake.token === 'TON' && stake.amount > 0) {
      if (!walletAddress) {
        tonConnectUI.openModal();
        return;
      }
      const tx = {
        validUntil: Math.floor(Date.now() / 1000) + 60,
        messages: [
          {
            address: SNAKE_CONTRACT_ADDRESS,
            amount: String(stake.amount * 1e9),
          },
        ],
      };
      try {
        await tonConnectUI.sendTransaction(tx);
      } catch {
        alert('Transaction failed');
        return;
      }
    }

    if (game === 'snake' && table?.id === 'single') {
      localStorage.removeItem(`snakeGameState_${aiCount}`);
      params.set('ai', aiCount);
      params.set('token', 'TPC');
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
          players: aiCount + 1,
        });
      } catch {}
    } else {
      if (stake.token) params.set('token', stake.token);
      if (stake.amount) params.set('amount', stake.amount);
    }

    navigate(`/games/${game}?${params.toString()}`);
  };

  let disabled = !canStartGame(game, table, stake, aiCount, players.length);
  if (
    game === 'snake' &&
    table &&
    table.id !== 'single' &&
    players.length > 0 &&
    players.length < table.capacity
  ) {
    disabled = false;
  }

  return (
    <div className="relative p-4 space-y-4 text-text">
      <img
        src="/assets/SnakeLaddersbackground.png"
        className="background-behind-board object-cover"
        alt=""
      />
      <h2 className="text-xl font-bold text-center capitalize">{game} Lobby</h2>
      <p className="text-center text-sm">Online users: {online}</p>
      {['snake', 'domino'].includes(game) && (
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
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-2">
        <h3 className="font-semibold">Select Stake</h3>
        <RoomSelector
          selected={stake}
          onSelect={setStake}
          tokens={table?.id === 'single' ? ['TPC'] : undefined}
        />
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
        </div>
      )}
      <button
        onClick={startGame}
        disabled={disabled}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-background rounded disabled:opacity-50"
      >
        Start Game
      </button>
    </div>
  );
}
