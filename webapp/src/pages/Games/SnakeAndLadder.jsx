import { useState, useEffect, useRef } from "react";
import DiceRoller from "../../components/DiceRoller.jsx";
import RoomPopup from "../../components/RoomPopup.jsx";
import useTelegramBackButton from "../../hooks/useTelegramBackButton.js";
import { getTelegramPhotoUrl } from "../../utils/telegram.js";
import { getSnakeLobbies } from "../../utils/api.js";

// Snake and ladder layout
const snakes = {
  17: 4, 19: 7, 21: 9, 27: 1, 54: 34,
  62: 18, 64: 60, 87: 24, 93: 73,
  95: 75, 98: 79, 99: 7,
};
const ladders = {
  3: 22, 5: 8, 11: 26, 20: 29,
  27: 56, 36: 44, 51: 67,
  71: 91, 80: 101, 201: 245, // ladder to the new Pot
};

const PLAYERS = 4;
const ROWS = 61;
const COLS = 4;
const FINAL_TILE = ROWS * COLS + 1;

function Board({ position, highlight, photoUrl, pot }) {
  const tiles = [];
  for (let r = 0; r < ROWS; r++) {
    const reversed = r % 2 === 1;
    for (let c = 0; c < COLS; c++) {
      const col = reversed ? COLS - 1 - c : c;
      const num = r * COLS + col + 1;
      tiles.push(
        <div
          key={num}
          className={`board-cell ${highlight === num ? "highlight" : ""}`}
          style={{ gridRowStart: ROWS - r, gridColumnStart: col + 1 }}
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
          {position === num && (
            <img src={photoUrl} alt="player" className="token" />
          )}
        </div>
      );
    }
  }

  const cellWidth = 135;
  const cellHeight = 68;

  return (
    <div className="flex justify-center">
      <div
        className="grid gap-1 relative"
        style={{
          width: `${cellWidth * COLS}px`,
          height: `${cellHeight * ROWS}px`,
          gridTemplateColumns: `repeat(${COLS}, ${cellWidth}px)`,
          gridTemplateRows: `repeat(${ROWS}, ${cellHeight}px)`,
          '--cell-width': `${cellWidth}px`,
          '--cell-height': `${cellHeight}px`,
        }}
      >
        {tiles}
        <div className={`pot-cell ${highlight === FINAL_TILE ? 'highlight' : ''}`}>
          <span className="font-bold">Pot</span>
          <span className="text-sm">{pot}</span>
          {position === FINAL_TILE && (
            <img src={photoUrl} alt="player" className="token" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function SnakeAndLadder() {
  useTelegramBackButton();
  const [pos, setPos] = useState(0);
  const [selection, setSelection] = useState(null);
  const [showRoom, setShowRoom] = useState(true);
  const [streak, setStreak] = useState(0);
  const [highlight, setHighlight] = useState(null);
  const [message, setMessage] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [pot, setPot] = useState(0);
  const moveSoundRef = useRef(null);
  const snakeSoundRef = useRef(null);
  const ladderSoundRef = useRef(null);
  const winSoundRef = useRef(null);

  const handleConfirm = () => {
    if (selection) {
      setPot(selection.amount * PLAYERS);
    }
    setShowRoom(false);
  };

  useEffect(() => {
    setPhotoUrl(getTelegramPhotoUrl());
    moveSoundRef.current = new Audio('https://snakes-and-ladders-game.netlify.app/audio/drop.mp3');
    moveSoundRef.current.preload = 'auto';
    snakeSoundRef.current = new Audio('https://snakes-and-ladders-game.netlify.app/audio/snake.mp3');
    snakeSoundRef.current.preload = 'auto';
    ladderSoundRef.current = new Audio('https://snakes-and-ladders-game.netlify.app/audio/ladder.mp3');
    ladderSoundRef.current.preload = 'auto';
    winSoundRef.current = new Audio('/assets/sounds/successful.mp3');
    winSoundRef.current.preload = 'auto';
    return () => {
      moveSoundRef.current?.pause();
      snakeSoundRef.current?.pause();
      ladderSoundRef.current?.pause();
      winSoundRef.current?.pause();
    };
  }, []);

  const handleRoll = (values) => {
    const value = Array.isArray(values)
      ? values.reduce((a, b) => a + b, 0)
      : values;

    setMessage("");
    let newStreak = value === 6 ? streak + 1 : 0;

    if (newStreak === 3) {
      setStreak(0);
      setMessage("Third 6 rolled, turn skipped!");
      return;
    }

    setStreak(newStreak);
    let current = pos;
    let target = current;

    if (current === 0) {
      if (value === 6) target = 1;
      else {
        setMessage("Need a 6 to start!");
        return;
      }
    } else if (current + value <= FINAL_TILE) {
      target = current + value;
    } else {
      setMessage("Need exact roll!");
    }

    const steps = [];
    for (let i = current + 1; i <= target; i++) steps.push(i);

    const move = (index) => {
      if (index >= steps.length) {
        let finalPos = steps[steps.length - 1] || current;
        let snake = false;
        let ladder = false;

        if (ladders[finalPos]) {
          finalPos = ladders[finalPos];
          ladder = true;
        }
        if (snakes[finalPos]) {
          finalPos = snakes[finalPos];
          snake = true;
        }

        setTimeout(() => {
          setPos(finalPos);
          setHighlight(null);
          if (finalPos === FINAL_TILE) {
            setMessage(`You win ${pot} ${selection?.token || ''}!`);
            winSoundRef.current?.play().catch(() => {});
          } else if (ladder) {
            ladderSoundRef.current?.play().catch(() => {});
          } else if (snake) {
            snakeSoundRef.current?.play().catch(() => {});
          }
        }, 300);
        return;
      }

      const next = steps[index];
      setPos(next);
      if (moveSoundRef.current) {
        moveSoundRef.current.currentTime = 0;
        moveSoundRef.current.play().catch(() => {});
      }
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
        you down. Reach the Pot first to win.
      </p>
      <RoomPopup
        open={showRoom}
        selection={selection}
        setSelection={setSelection}
        onConfirm={handleConfirm}
      />
      <Board position={pos} highlight={highlight} photoUrl={photoUrl} pot={pot} />
      {message && <div className="text-center font-semibold">{message}</div>}
      <DiceRoller onRollEnd={handleRoll} clickable numDice={1} />
    </div>
  );
}
