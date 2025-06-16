import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TableSelector from '../../components/TableSelector.jsx';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { getSnakeLobbies, getSnakeLobby } from '../../utils/api.js';
import { socket } from '../../utils/socket.js';
import {
  getTelegramId,
  getTelegramUsername,
  getTelegramFirstName
} from '../../utils/telegram.js';

export default function Lobby() {
  const { game } = useParams();
  const navigate = useNavigate();
  useTelegramBackButton();

  const [tables, setTables] = useState([]);
  const [table, setTable] = useState(null);
  const [stake, setStake] = useState({ token: '', amount: 0 });
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    socket.connect();
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (game === 'snake') {
      let active = true;
      function load() {
        getSnakeLobbies()
          .then((data) => {
            if (active) setTables(data);
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
    if (game === 'snake' && table) {
      try {
        const id = getTelegramId();
        const name = getTelegramUsername() || getTelegramFirstName();
        socket.emit('joinRoom', { roomId: table.id, playerId: String(id), name });
      } catch {}
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

  const startGame = () => {
    const params = new URLSearchParams();
    if (table) params.set('table', table.id);
    if (stake.token) params.set('token', stake.token);
    if (stake.amount) params.set('amount', stake.amount);
    navigate(`/games/${game}?${params.toString()}`);
  };

  const startTest = () => {
    navigate(`/games/${game}?test=1`);
  };

  const disabled =
    !stake.token ||
    !stake.amount ||
    (game === 'snake' && (!table || players.length < table.capacity));

  return (
    <div className="p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold text-center capitalize">{game} Lobby</h2>
      {game === 'snake' && (
        <div className="space-y-2">
          <h3 className="font-semibold">Select Table</h3>
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
        <RoomSelector selected={stake} onSelect={setStake} />
      </div>
      <button
        onClick={startGame}
        disabled={disabled}
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-white rounded disabled:opacity-50"
      >
        Start Game
      </button>
      <button
        onClick={startTest}
        className="px-4 py-2 w-full bg-gray-600 hover:bg-gray-500 text-white rounded"
      >
        Start Test
      </button>
    </div>
  );
}
