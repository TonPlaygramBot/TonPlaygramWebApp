import { useRef, useState } from 'react';
import DiceRoller from '../../components/DiceRoller.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

const snakes = { 14: 7, 11: 5 };
const ladders = { 3: 8, 6: 12 };

function Board({ position }) {
  const rows = [];
  for (let r = 4; r >= 0; r--) {
    const cols = [];
    const dir = (4 - r) % 2 === 0 ? [1, 2, 3] : [3, 2, 1];
    for (const c of dir) {
      const num = r * 3 + c;
      cols.push(
        <div key={num} className="board-cell">
          {num}
          {position === num && <div className="token" />}
        </div>
      );
    }
    rows.push(cols);
  }
  return (
    <div className="board-3d flex justify-center">
      <div className="board-3d-grid grid grid-rows-5 grid-cols-3 gap-1 w-60 h-96">
        {rows.flat()}
      </div>
    </div>
  );
}

export default function SnakeAndLadder() {
  useTelegramBackButton();
  const [pos, setPos] = useState(1);
  const [message, setMessage] = useState('');
  const containerRef = useRef(null);

  const handleRoll = (value) => {
    setPos((p) => {
      let next = p + value;
      if (next > 15) next = 15;
      if (ladders[next]) next = ladders[next];
      if (snakes[next]) next = snakes[next];
      if (next === 15) setMessage('You win!');
      return next;
    });
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
      <Board position={pos} />
      {message && <div className="text-center font-semibold">{message}</div>}
      <DiceRoller onRollEnd={handleRoll} />
      <button onClick={toggleFull} className="px-3 py-1 bg-primary text-white rounded">
        Toggle Full Screen
      </button>
    </div>
  );
}
