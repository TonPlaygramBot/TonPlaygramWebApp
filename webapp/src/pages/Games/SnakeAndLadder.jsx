import { useEffect, useRef, useState } from 'react';
import DiceRoller from '../../components/DiceRoller.jsx';
import RoomPopup from '../../components/RoomPopup.jsx';
import ConnectWallet from '../../components/ConnectWallet.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { socket } from '../../utils/socket.js';

const boardSnakes = { 99: 41, 85: 58, 70: 55 };
const boardLadders = { 2: 38, 15: 26, 22: 58 };
const COLORS = ['#e11d48', '#0284c7', '#10b981', '#eab308'];

function Board({ players, highlight }) {
  const tiles = [];
  for (let r = 9; r >= 0; r--) {
    const reversed = (9 - r) % 2 === 1;
    for (let c = 0; c < 10; c++) {
      const col = reversed ? 9 - c : c;
      const num = r * 10 + col + 1;
      tiles.push(
        <div
          key={num}
          className={`board-cell ${highlight === num ? 'highlight' : ''}`}
          style={{ gridRowStart: 10 - r, gridColumnStart: col + 1 }}
        >
          {num}
          {boardSnakes[num] && (
            <div className="absolute inset-0 flex items-center justify-center text-red-500 text-xl pointer-events-none">
              🐍
            </div>
          )}
          {boardLadders[num] && (
            <div className="absolute inset-0 flex items-center justify-center text-green-500 text-xl pointer-events-none">
              🪜
            </div>
          )}
          {players.map((p, i) =>
            p.position === num ? (
              <div
                key={p.id}
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
            ) : null
          )}
        </div>
      );
    }
  }

  return (
    <div className="flex justify-center">
      <div className="grid grid-rows-10 grid-cols-10 gap-1 w-[640px] h-[640px] relative">
        {tiles}
      </div>
    </div>
  );
}

export default function SnakeAndLadder() {
  useTelegramBackButton();
  const [selection, setSelection] = useState(null);
  const [showRoom, setShowRoom] = useState(true);
  const [players, setPlayers] = useState([]);
  const [turn, setTurn] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const [message, setMessage] = useState('');
  const containerRef = useRef(null);

  const playerIdRef = useRef(() => {
    const id = localStorage.getItem('snlPlayerId');
    if (id) return id;
    const nid = Math.random().toString(36).slice(2);
    localStorage.setItem('snlPlayerId', nid);
    return nid;
  });

  useEffect(() => {
    const onState = (state) => {
      setPlayers(state.players);
      setTurn(state.turn);
    };
    socket.on('state', onState);
    socket.on('playerJoined', onState);
    socket.on('playerLeft', onState);
    socket.on('movePlayer', ({ playerId, to }) => {
      setPlayers((ps) => ps.map((p) => (p.id === playerId ? { ...p, position: to } : p)));
    });
    socket.on('nextTurn', ({ playerId }) => setTurn(playerId));
    socket.on('gameWon', ({ playerId }) => setMessage(`${playerId} wins!`));
    return () => {
      socket.off('state', onState);
      socket.off('playerJoined', onState);
      socket.off('playerLeft', onState);
      socket.off('movePlayer');
      socket.off('nextTurn');
      socket.off('gameWon');
    };
  }, []);

  const join = () => {
    const roomId = selection?.token || 'default';
    setShowRoom(false);
    socket.emit('joinRoom', { roomId, playerId: playerIdRef.current, name: playerIdRef.current });
  };

  const handleRoll = () => {
    socket.emit('rollDice');
  };

  const toggleFull = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      el.requestFullscreen?.();
    }
  };

  return (
    <div className="p-4 space-y-4 text-text" ref={containerRef}>
      <h2 className="text-xl font-bold">Snake &amp; Ladder</h2>
      <RoomPopup open={showRoom} selection={selection} setSelection={setSelection} onConfirm={join} />
      <ConnectWallet />
      <Board players={players} highlight={highlight} />
      {message && <div className="text-center font-semibold">{message}</div>}
      {turn === playerIdRef.current && <DiceRoller onRollEnd={handleRoll} />}
      <button onClick={toggleFull} className="px-3 py-1 bg-primary text-white rounded">
        Toggle Full Screen
      </button>
    </div>
  );
}
