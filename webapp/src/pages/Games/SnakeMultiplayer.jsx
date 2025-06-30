import { useState, useEffect } from 'react';
import SnakeBoard from '../../components/SnakeBoard.jsx';
import DiceRoller from '../../components/DiceRoller.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { socket } from '../../utils/socket.js';
import { getSnakeBoard, getSnakeLobby, pingOnline } from '../../utils/api.js';
import { getTelegramId, getTelegramFirstName, getPlayerId } from '../../utils/telegram.js';

const TOKEN_COLORS = [
  { name: 'blue', color: '#60a5fa' },
  { name: 'red', color: '#ef4444' },
  { name: 'green', color: '#4ade80' },
  { name: 'yellow', color: '#facc15' },
];

export default function SnakeMultiplayer() {
  useTelegramBackButton();

  const [snakes, setSnakes] = useState({});
  const [ladders, setLadders] = useState({});
  const [snakeOffsets, setSnakeOffsets] = useState({});
  const [ladderOffsets, setLadderOffsets] = useState({});

  const [players, setPlayers] = useState([]); // { playerId, name, color, photoUrl }
  const [positions, setPositions] = useState({}); // playerId -> position
  const [currentTurn, setCurrentTurn] = useState(null);
  const [rollResult, setRollResult] = useState(null);
  const [rollTrigger, setRollTrigger] = useState(0);
  const [roomId, setRoomId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('table') || 'snake-4';
    setRoomId(room);

    getSnakeBoard(room)
      .then(({ snakes: s = {}, ladders: l = {} }) => {
        const limit = (obj) => Object.fromEntries(Object.entries(obj).slice(0, 8));
        const sl = limit(s);
        const ll = limit(l);
        setSnakes(sl);
        setLadders(ll);
        const snk = {};
        Object.entries(sl).forEach(([start, end]) => {
          snk[start] = start - end;
        });
        const lad = {};
        Object.entries(ll).forEach(([start, end]) => {
          const fin = typeof end === 'object' ? end.end : end;
          lad[start] = fin - start;
        });
        setSnakeOffsets(snk);
        setLadderOffsets(lad);
      })
      .catch(() => {});

    getSnakeLobby(room)
      .then((data) => {
        const cols = TOKEN_COLORS.map((t) => t.color);
        const arr = (data.players || []).map((p, i) => ({
          playerId: p.id,
          name: p.name,
          color: cols[i % cols.length],
          photoUrl: '/assets/icons/profile.svg',
        }));
        setPlayers(arr);
        const map = {};
        arr.forEach((p) => (map[p.playerId] = 0));
        setPositions(map);
      })
      .catch(() => {});

    const pid = getPlayerId();
    const name = getTelegramFirstName() || String(pid);
    socket.emit('joinRoom', { roomId: room, playerId: pid, name });

    const reconnect = () => {
      socket.emit('joinRoom', { roomId: room, playerId: pid, name });
    };
    socket.on('connect', reconnect);
    return () => {
      socket.off('connect', reconnect);
    };
  }, []);

  useEffect(() => {
    const id = getPlayerId();
    function ping() {
      pingOnline(id).catch(() => {});
    }
    ping();
    const t = setInterval(ping, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onPlayerJoined({ playerId, name }) {
      setPlayers((pls) => {
        if (pls.some((p) => p.playerId === playerId)) return pls;
        const color = TOKEN_COLORS[pls.length % TOKEN_COLORS.length].color;
        return [
          ...pls,
          { playerId, name, color, photoUrl: '/assets/icons/profile.svg' },
        ];
      });
      setPositions((pos) => ({ ...pos, [playerId]: 0 }));
    }
    function onGameStarted() {}
    function onTurnChanged({ playerId }) {
      setCurrentTurn(playerId);
    }
    function onDiceRolled({ playerId, value }) {
      setRollResult({ playerId, value });
      setRollTrigger((t) => t + 1);
    }
    function onMovePlayer({ playerId, to }) {
      setPositions((pos) => ({ ...pos, [playerId]: to }));
    }
    function onSnakeOrLadder({ playerId, to }) {
      setPositions((pos) => ({ ...pos, [playerId]: to }));
    }
    function onPlayerReset({ playerId }) {
      setPositions((pos) => ({ ...pos, [playerId]: 0 }));
    }
    function onPlayerLeft({ playerId }) {
      setPlayers((pls) => pls.filter((p) => p.playerId !== playerId));
    }
    function onGameWon({ playerId }) {
      alert(`${playerId} won!`);
    }

    socket.on('playerJoined', onPlayerJoined);
    socket.on('gameStarted', onGameStarted);
    socket.on('turnChanged', onTurnChanged);
    socket.on('diceRolled', onDiceRolled);
    socket.on('movePlayer', onMovePlayer);
    socket.on('snakeOrLadder', onSnakeOrLadder);
    socket.on('playerReset', onPlayerReset);
    socket.on('playerLeft', onPlayerLeft);
    socket.on('gameWon', onGameWon);

    return () => {
      socket.off('playerJoined', onPlayerJoined);
      socket.off('gameStarted', onGameStarted);
      socket.off('turnChanged', onTurnChanged);
      socket.off('diceRolled', onDiceRolled);
      socket.off('movePlayer', onMovePlayer);
      socket.off('snakeOrLadder', onSnakeOrLadder);
      socket.off('playerReset', onPlayerReset);
      socket.off('playerLeft', onPlayerLeft);
      socket.off('gameWon', onGameWon);
    };
  }, []);

  const boardPlayers = players.map((p) => ({
    position: positions[p.playerId] || 0,
    photoUrl: p.photoUrl,
    type: 'normal',
    color: p.color,
  }));

  const handleRoll = () => {
    socket.emit('rollDice');
  };

  return (
    <div className="p-4 pb-32 space-y-4 text-text flex flex-col items-center">
      <h2 className="text-xl font-bold">Multiplayer Snake &amp; Ladder</h2>
      <SnakeBoard
        players={boardPlayers}
        highlight={null}
        trail={[]}
        pot={101}
        snakes={snakes}
        ladders={ladders}
        snakeOffsets={snakeOffsets}
        ladderOffsets={ladderOffsets}
        offsetPopup={null}
        celebrate={false}
        token="TON"
        tokenType="normal"
        diceCells={{}}
        rollingIndex={null}
        currentTurn={players.findIndex((p) => p.playerId === currentTurn)}
        burning={[]}
      />
      <div className="mt-4 flex flex-col items-center space-y-2">
        <DiceRoller
          numDice={1}
          onRollStart={handleRoll}
          trigger={rollTrigger}
          showButton={true}
        />
        {rollResult && (
          <div className="text-center">
            Player {rollResult.playerId} rolled {rollResult.value}
          </div>
        )}
      </div>
    </div>
  );
}

