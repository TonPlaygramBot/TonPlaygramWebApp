import { useState } from "react";
import DiceRoller from "../../components/DiceRoller.jsx";
import RoomPopup from "../../components/RoomPopup.jsx";
import useTelegramBackButton from "../../hooks/useTelegramBackButton.js";

// Simple snake and ladder layout for a 10x10 board
const snakes = {
  17: 4,
  19: 7,
  21: 9,
  27: 1,
  54: 34,
  62: 18,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  98: 79,
  99: 7,
};
const ladders = {
  3: 22,
  5: 8,
  11: 26,
  20: 29,
  27: 56,
  36: 44,
  51: 67,
  71: 91,
  80: 100,
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
      <div className="grid grid-rows-10 grid-cols-10 gap-1 w-[1280px] h-[1280px] relative">
        {tiles}
      </div>
    </div>
  );
}

export default function SnakeAndLadder() {
  useTelegramBackButton();
  const [pos, setPos] = useState(0);
  const [selection, setSelection] = useState(null);
  const [showRoom, setShowRoom] = useState(true);
  const [highlight, setHighlight] = useState(null);
  const [message, setMessage] = useState("");

  const handleRoll = (values) => {
    const value = Array.isArray(values)
      ? values.reduce((a, b) => a + b, 0)
      : values;
    setMessage("");
    let current = pos;
    let target = current;
    if (current === 0) {
      if (value === 6) target = 1; else {
        setMessage("Need a 6 to start!");
        return;
      }
    } else if (current + value <= 100) {
      target = current + value;
    } else {
      setMessage("Need exact roll!");
    }
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


  return (
    <div className="p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold">Snake &amp; Ladder</h2>
      <p className="text-sm text-subtext">
        Roll the dice to move across the board. Ladders move you up, snakes bring
        you down. Reach tile 100 first to win.
      </p>
      <RoomPopup
        open={showRoom}
        selection={selection}
        setSelection={setSelection}
        onConfirm={() => setShowRoom(false)}
      />
      <Board position={pos} highlight={highlight} />
      {message && <div className="text-center font-semibold">{message}</div>}
      <DiceRoller onRollEnd={handleRoll} clickable />
    </div>
  );
}
