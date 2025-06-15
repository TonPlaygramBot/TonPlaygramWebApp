import { useRef, useState } from 'react';
import DiceRoller from '../../components/DiceRoller.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

const snakes = { 22: 10, 17: 5, 24: 16 };
const ladders = { 3: 11, 6: 14, 12: 21 };

function Board({ position }) {
  const path = [
    [4,0],[4,1],[4,2],[4,3],[4,4],
    [3,4],[3,3],[3,2],[3,1],[3,0],
    [2,0],[2,1],[2,2],[2,3],[2,4],
    [1,4],[1,3],[1,2],[1,1],[1,0],
    [0,0],[0,1],[0,2],[0,3],[0,4]
  ];

  const tiles = path.map(([r,c], i) => (
    <div
      key={i+1}
      className="board-cell"
      style={{ gridRowStart: 5 - r, gridColumnStart: c + 1 }}
    >
      {i + 1}
      {position === i + 1 && <div className="token" />}
    </div>
  ));

  const style = { transform: 'rotateX(30deg) rotateZ(45deg)' };

  return (
    <div className="board-3d flex justify-center">
      <div className="board-frame">
        <div className="board-3d-grid" style={style}>
          <div className="grid grid-rows-5 grid-cols-5 gap-1 w-80 h-80 relative">
            {tiles}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SnakeAndLadder() {
  useTelegramBackButton();
  const [pos, setPos] = useState(1);
  const [message, setMessage] = useState('');
  const containerRef = useRef(null);


  const handleRoll = (values) => {
    const value = Array.isArray(values) ? values.reduce((a, b) => a + b, 0) : values;
    setMessage('');
    let current = pos;
    let target = current + value;
    if (target > 25) target = 25;
    const steps = [];
    for (let i = current + 1; i <= target; i++) steps.push(i);

    const move = (index) => {
      if (index >= steps.length) {
        let finalPos = steps[steps.length - 1] || current;
        if (ladders[finalPos]) finalPos = ladders[finalPos];
        if (snakes[finalPos]) finalPos = snakes[finalPos];
        setTimeout(() => {
          setPos(finalPos);
          if (finalPos === 25) setMessage('You win!');
        }, 300);
        return;
      }
      const next = steps[index];
      setPos(next);
      setTimeout(() => move(index + 1), 300);
    };
    move(0);
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
