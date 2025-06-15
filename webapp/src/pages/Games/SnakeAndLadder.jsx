import { useRef, useState } from "react";
import DiceRoller from "../../components/DiceRoller.jsx";
import useTelegramBackButton from "../../hooks/useTelegramBackButton.js";

// Simple snake and ladder layout for a 10x10 board
const snakes = {
  16: 6,
  48: 30,
  62: 19,
  88: 24,
  95: 56,
};
const ladders = {
  3: 22,
  25: 44,
  40: 60,
  51: 67,
  71: 90,
};

function Board({ position, highlight }) {
  const tiles = [];
  for (let r = 9; r >= 0; r--) {
    const reversed = (9 - r) % 2 === 1;
    for (let c = 0; c < 10; c++) {
      const col = reversed ? 9 - c : c;
      const num = r * 10 + col + 1;
      tiles.push(
        <div
          key={num}
          className={`board-cell ${highlight === num ? "highlight" : ""}`}
          style={{ gridRowStart: 10 - r, gridColumnStart: col + 1 }}
        >
          {num}
          {snakes[num] && (
            <div className="absolute inset-0 flex items-center justify-center text-red-500 text-xl pointer-events-none">
              🐍
            </div>
          )}
          {ladders[num] && (
            <div className="absolute inset-0 flex items-center justify-center text-green-500 text-xl pointer-events-none">
              🪜
            </div>
          )}
          {position === num && <div className="token" />}
        </div>,
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
  const [pos, setPos] = useState(1);
  const [highlight, setHighlight] = useState(null);
  const [message, setMessage] = useState("");
  const containerRef = useRef(null);

  const handleRoll = (values) => {
    const value = Array.isArray(values)
      ? values.reduce((a, b) => a + b, 0)
      : values;
    setMessage("");
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
          setHighlight(null);
          if (finalPos === 100) setMessage("You win!");
        }, 300);
        return;
      }
      const next = steps[index];
      setPos(next);
      setHighlight(next);
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
      <Board position={pos} highlight={highlight} />
      {message && <div className="text-center font-semibold">{message}</div>}
      <DiceRoller onRollEnd={handleRoll} />
      <button
        onClick={toggleFull}
        className="px-3 py-1 bg-primary text-white rounded"
      >
        Toggle Full Screen
      </button>
    </div>
  );
}
