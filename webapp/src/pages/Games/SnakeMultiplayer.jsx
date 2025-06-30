import { useEffect, useState } from 'react';
import SnakeBoard from '../../components/SnakeBoard.jsx';
import DiceRoller from '../../components/DiceRoller.jsx';
import { socket } from '../../utils/socket.js';
import { getTelegramId, getTelegramPhotoUrl } from '../../utils/telegram.js';
import { getProfile, getSnakeBoard, getSnakeLobby } from '../../utils/api.js';

const TOKEN_COLORS = [
  { name: 'blue', color: '#60a5fa' },
  { name: 'red', color: '#ef4444' },
  { name: 'green', color: '#4ade80' },
  { name: 'yellow', color: '#facc15' },
];

export default function SnakeMultiplayer() {
  const [snakes, setSnakes] = useState({});
  const [ladders, setLadders] = useState({});
  const [players, setPlayers] = useState([]);
  const [positions, setPositions] = useState({});
  const [currentTurn, setCurrentTurn] = useState(null);
  const [waiting, setWaiting] = useState(true);
  const [diceTrigger, setDiceTrigger] = useState(0);
  const [token, setToken] = useState('TPC');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tableId = params.get('table') || 'snake-4';
    const tok = params.get('token');
    if (tok) setToken(tok.toUpperCase());

    getSnakeBoard(tableId)
      .then(({ snakes = {}, ladders = {} }) => {
        setSnakes(snakes);
        setLadders(ladders);
      })
      .catch(() => {});

    getSnakeLobby(tableId)
      .then((data) => {
        const list = data.players || [];
        setPlayers(
          list.map((p, i) => ({
            id: p.id,
            name: p.name,
            photoUrl:
              p.id === getTelegramId()
                ? getTelegramPhotoUrl()
                : '/assets/icons/profile.svg',
            color: TOKEN_COLORS[i % TOKEN_COLORS.length].color,
          }))
        );
      })
      .catch(() => {});

    const id = getTelegramId();
    let name = String(id);
    getProfile(id)
      .then((p) => {
        name = p?.nickname || p?.firstName || name;
      })
      .catch(() => {})
      .finally(() => {
        socket.emit('joinRoom', { roomId: tableId, playerId: id, name });
      });

    socket.on('playerJoined', ({ playerId, name }) => {
      setPlayers((prev) => {
        if (prev.find((p) => p.id === playerId)) return prev;
        const idx = prev.length;
        return [
          ...prev,
          {
            id: playerId,
            name,
            photoUrl:
              playerId === id ? getTelegramPhotoUrl() : '/assets/icons/profile.svg',
            color: TOKEN_COLORS[idx % TOKEN_COLORS.length].color,
          },
        ];
      });
    });

    socket.on('playerLeft', ({ playerId }) => {
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
      setPositions((pos) => {
        const copy = { ...pos };
        delete copy[playerId];
        return copy;
      });
    });

    socket.on('gameStarted', () => setWaiting(false));
    socket.on('turnChanged', ({ playerId }) => setCurrentTurn(playerId));
    socket.on('diceRolled', ({ playerId }) => {
      if (playerId === id) setDiceTrigger((t) => t + 1);
    });
    socket.on('movePlayer', ({ playerId, to }) => {
      setPositions((pos) => ({ ...pos, [playerId]: to }));
    });
    socket.on('snakeOrLadder', ({ playerId, to }) => {
      setPositions((pos) => ({ ...pos, [playerId]: to }));
    });
    socket.on('gameWon', () => setWaiting(false));

    return () => {
      socket.off('playerJoined');
      socket.off('playerLeft');
      socket.off('gameStarted');
      socket.off('turnChanged');
      socket.off('diceRolled');
      socket.off('movePlayer');
      socket.off('snakeOrLadder');
      socket.off('gameWon');
    };
  }, []);

  const boardPlayers = players.map((p) => ({
    position: positions[p.id] || 0,
    photoUrl: p.photoUrl,
    type: 'normal',
    color: p.color,
  }));

  const myId = getTelegramId();
  const myTurn = currentTurn === myId;

  const handleRollEnd = () => {
    socket.emit('rollDice');
  };

  return (
    <div className="p-4 pb-32 space-y-4 text-text flex flex-col justify-end items-center relative w-full flex-grow">
      <SnakeBoard
        players={boardPlayers}
        snakes={snakes}
        ladders={ladders}
        pot={101}
        snakeOffsets={{}}
        ladderOffsets={{}}
        token={token}
        tokenType="normal"
      />
      {waiting && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70">
          <p className="text-white text-lg">Waiting for players...</p>
        </div>
      )}
      {myTurn && !waiting && (
        <DiceRoller onRollEnd={handleRollEnd} trigger={diceTrigger} muted={false} />
      )}
    </div>
  );
}
