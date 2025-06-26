import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TableSelector from '../../components/TableSelector.jsx';
import RoomSelector from '../../components/RoomSelector.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  getSnakeLobbies,
  getSnakeLobby,
  getSnakeBoard,
  getProfile,
  fetchTelegramInfo,
} from '../../utils/api.js';
import { getTelegramId, getTelegramPhotoUrl } from '../../utils/telegram.js';
import { canStartGame } from '../../utils/lobby.js';

export default function Lobby() {
  const { game } = useParams();
  const navigate = useNavigate();
  useTelegramBackButton();

  const [tables, setTables] = useState([]);
  const [table, setTable] = useState(null);
  const [stake, setStake] = useState({ token: '', amount: 0 });
  const [players, setPlayers] = useState([]);
  const [aiCount, setAiCount] = useState(0);

  // Preload the player's profile photo so the game can display it immediately
  useEffect(() => {
    const id = getTelegramId();
    getProfile(id)
      .then((p) => {
        const photo = p?.photo || getTelegramPhotoUrl();
        if (photo) localStorage.setItem('snakeUserPhoto', photo);
        else {
          fetchTelegramInfo(id)
            .then((info) => {
              if (info?.photoUrl)
                localStorage.setItem('snakeUserPhoto', info.photoUrl);
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        const url = getTelegramPhotoUrl();
        if (url) localStorage.setItem('snakeUserPhoto', url);
        else {
          fetchTelegramInfo(id)
            .then((info) => {
              if (info?.photoUrl)
                localStorage.setItem('snakeUserPhoto', info.photoUrl);
            })
            .catch(() => {});
        }
      });
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
    } else if (game === 'ludo') {
      setTables([{ id: 'single', label: 'Single Player vs AI' }]);
    }
  }, [game]);

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

  // Preload board data for the selected table so the game loads instantly
  useEffect(() => {
    if (game === 'snake' && table) {
      const key = `snakeBoard_${table.id}`;
      getSnakeBoard(table.id)
        .then((data) => {
          localStorage.setItem(key, JSON.stringify(data));
        })
        .catch(() => {});
    }
  }, [game, table]);

  const startGame = () => {
    const params = new URLSearchParams();
    if (table) params.set('table', table.id);
    if (table?.id === 'single') {
      params.set('ai', aiCount);
    } else {
      if (stake.token) params.set('token', stake.token);
      if (stake.amount) params.set('amount', stake.amount);
    }
    navigate(`/games/${game}?${params.toString()}`);
  };

  const disabled = !canStartGame(game, table, stake, aiCount);

  return (
    <div className="p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold text-center capitalize">{game} Lobby</h2>
      {(game === 'snake' || game === 'ludo') && (
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
      {!( (game === 'ludo' || game === 'snake') && table?.id === 'single') && (
        <div className="space-y-2">
          <h3 className="font-semibold">Select Stake</h3>
          <RoomSelector selected={stake} onSelect={setStake} />
        </div>
      )}
      {(game === 'ludo' || game === 'snake') && table?.id === 'single' && (
        <div className="space-y-2">
          <h3 className="font-semibold">How many AI opponents?</h3>
          <div className="flex gap-2">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => setAiCount(n)}
                className={`px-2 py-1 border rounded ${
                  aiCount === n ? 'bg-yellow-400 text-gray-900' : 'bg-gray-700 text-white'
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
        className="px-4 py-2 w-full bg-primary hover:bg-primary-hover text-white rounded disabled:opacity-50"
      >
        Start Game
      </button>
    </div>
  );
}
