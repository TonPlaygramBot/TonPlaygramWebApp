import { useRef, useState } from 'react';
import DiceRoller from '../../components/DiceRoller.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

const snakes = { 94: 74, 87: 36, 62: 19, 54: 34, 17: 7 };
const ladders = { 4: 14, 9: 31, 20: 38, 28: 84, 40: 59 };

function Board({ position, rotation }) {
  const rows = [];
  for (let r = 9; r >= 0; r--) {
    const cols = [];
    const dir = (9 - r) % 2 === 0 ?
      [1,2,3,4,5,6,7,8,9,10] :
      [10,9,8,7,6,5,4,3,2,1];
    for (const c of dir) {
      const num = r * 10 + c;
      cols.push(
        <div key={num} className="board-cell">
          {num}
          {position === num && <div className="token" />}
        </div>
      );
    }
    rows.push(cols);
  }
  const style = {
    transform: `rotateX(55deg) rotateZ(${45 + rotation}deg)`
  };
  return (
    <div className="board-3d flex justify-center">
      <div className="board-frame">
        <div
          className="board-3d-grid grid grid-rows-10 grid-cols-10 gap-1 w-96 h-96"
          style={style}
        >
          {rows.flat()}
        </div>
      </div>
    </div>
  );
}

export default function SnakeAndLadder() {
  useTelegramBackButton();
  const [pos, setPos] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [message, setMessage] = useState('');
  const containerRef = useRef(null);

  const calcRotation = (p) => ((Math.floor((p - 1) / 10) % 4) * 90);

  const handleRoll = (value) => {
    setMessage('');
    let current = pos;
    let target = current + value;
    if (target > 100) target = 100;
    const steps = [];
    for (let i = current + 1; i <= target; i++) steps.push(i);

    const move = (index) => {
      if (index >= steps.length) {
        let finalPos = steps[steps.length - 1] || current;
        if (ladders[finalPos]) finalPos = ladders[finalPos];
        if (snakes[finalPos]) finalPos = snakes[finalPos];
        setTimeout(() => {
          setPos(finalPos);
          setRotation(calcRotation(finalPos));
          if (finalPos === 100) setMessage('You win!');
        }, 300);
        return;
      }
      const next = steps[index];
      setPos(next);
      setRotation(calcRotation(next));
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
      <Board position={pos} rotation={rotation} />
      {message && <div className="text-center font-semibold">{message}</div>}
      <DiceRoller onRollEnd={handleRoll} />
      <button onClick={toggleFull} className="px-3 py-1 bg-primary text-white rounded">
        Toggle Full Screen
      </button>
    </div>
  );
}
