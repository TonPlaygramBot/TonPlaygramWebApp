import { useState, useEffect, useRef } from "react";
import DiceRoller from "../../components/DiceRoller.jsx";
import InfoPopup from "../../components/InfoPopup.jsx";
import { AiOutlineInfoCircle } from "react-icons/ai";
import useTelegramBackButton from "../../hooks/useTelegramBackButton.js";
import { getTelegramPhotoUrl } from "../../utils/telegram.js";

// Generate random snakes and ladders each session
function generateSnakesAndLadders() {
  const snakes = {};
  const ladders = {};
  const used = new Set();
  const pick = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  while (Object.keys(ladders).length < 3) {
    const start = pick(2, 90);
    const end = start + pick(5, 15);
    if (end >= 100 || used.has(start) || used.has(end)) continue;
    ladders[start] = end;
    used.add(start);
    used.add(end);
  }

  while (Object.keys(snakes).length < 3) {
    const start = pick(10, 99);
    const end = start - pick(5, 15);
    if (end <= 1 || used.has(start) || used.has(end)) continue;
    snakes[start] = end;
    used.add(start);
    used.add(end);
  }

  return { snakes, ladders };
}

const PLAYERS = 4;
// Adjusted board dimensions to show five columns
// while keeping the total cell count at 100
const ROWS = 20;
const COLS = 5;
const FINAL_TILE = ROWS * COLS + 1; // 101
// Portion of the viewport to keep below the player's token when scrolling.
// Larger values keep the token closer to the bottom so the board follows
// the user row by row from a fixed camera position.
const CAMERA_OFFSET = 0.9;

function Board({ position, highlight, photoUrl, pot, snakes, ladders }) {
  const containerRef = useRef(null);
  const tiles = [];

  for (let r = 0; r < ROWS; r++) {
    const reversed = r % 2 === 1;
    for (let c = 0; c < COLS; c++) {
      const col = reversed ? COLS - 1 - c : c;
      const num = r * COLS + col + 1;
      tiles.push(
        <div
          key={num}
          data-cell={num}
          className={`board-cell ${highlight === num ? "highlight" : ""}`}
          style={{ gridRowStart: ROWS - r, gridColumnStart: col + 1 }}
        >
          {num}
          {snakes[num] && (
            <div className="absolute inset-0 flex items-center justify-center text-red-500 text-xl pointer-events-none board-marker">🐍</div>
          )}
          {ladders[num] && (
            <div className="absolute inset-0 flex items-center justify-center text-green-500 text-xl pointer-events-none board-marker">🪜</div>
          )}
          {position === num && (
            <img src={photoUrl} alt="player" className="token" />
          )}
        </div>
      );
    }
  }

  // Enlarge cells so the profile picture fits without cropping
  const cellWidth = 70;
  const cellHeight = 70;

  const connectors = [];

  const getCenter = (num) => {
    const r = Math.floor((num - 1) / COLS);
    const reversed = r % 2 === 1;
    const col = reversed ? COLS - 1 - ((num - 1) % COLS) : (num - 1) % COLS;
    const rowFromBottom = r;
    const x = col * cellWidth + cellWidth / 2;
    const y = (ROWS - 1 - rowFromBottom) * cellHeight + cellHeight / 2;
    return { x, y };
  };

  const renderConnector = (from, to, type) => {
    const start = getCenter(from);
    const end = getCenter(to);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    return (
      <div
        key={`${type}-${from}-${to}`}
        className={`${type}-connector`}
        style={{
          width: `${length}px`,
          top: `${start.y}px`,
          left: `${start.x}px`,
          transform: `rotate(${angle}deg) translateZ(6px)`,
        }}
      />
    );
  };

  for (const [s, e] of Object.entries(ladders)) {
    connectors.push(renderConnector(Number(s), Number(e), 'ladder'));
  }
  for (const [s, e] of Object.entries(snakes)) {
    connectors.push(renderConnector(Number(s), Number(e), 'snake'));
  }
  // Use a fixed zoom level so the camera angle stays locked while the board
  // follows the player every row.
  const MIN_ZOOM = 1.3;
  const MAX_ZOOM = 1.3;
  const zoom = MIN_ZOOM;

  useEffect(() => {
    const container = containerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || position === 0) return;
    const cell = container.querySelector(`[data-cell='${position}']`);
    if (cell) {
      const cRect = container.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();
      // Keep the token near the bottom of the viewport so the camera follows
      // from a lower angle and focuses attention on the logo at the top
      const offset =
        cellRect.top - cRect.top - cRect.height * CAMERA_OFFSET + cellRect.height / 2;
      const target = Math.min(
        container.scrollHeight - cRect.height,
        Math.max(0, container.scrollTop + offset)
      );
      container.scrollTo({ top: target, behavior: 'smooth' });
    }
  }, [position]);

  return (
    <div className="flex justify-center items-center w-screen overflow-hidden">
      <div
        ref={containerRef}
        className="overflow-y-auto overflow-x-hidden"
        style={{ height: '80vh', overscrollBehaviorY: 'contain', paddingTop: '0.5rem' }}
      >
        <div className="snake-board-tilt">
          <div
            className="snake-board-grid grid gap-1 relative"
            style={{
              width: `${cellWidth * COLS}px`,
              height: `${cellHeight * ROWS}px`,
              gridTemplateColumns: `repeat(${COLS}, ${cellWidth}px)`,
              gridTemplateRows: `repeat(${ROWS}, ${cellHeight}px)`,
              '--cell-width': `${cellWidth}px`,
              '--cell-height': `${cellHeight}px`,
              // Lower camera angle and lock it to follow the player
              transform: `rotateX(60deg) scale(${zoom})`,
            }}
          >
            {tiles}
            {connectors}
            <div className={`pot-cell ${highlight === FINAL_TILE ? 'highlight' : ''}`}>
              <span className="font-bold">Pot</span>
              <span className="text-sm">{pot}</span>
              {position === FINAL_TILE && (
                <img src={photoUrl} alt="player" className="token" />
              )}
            </div>
            <div className="logo-wall-main" />
            <div className="logo-wall-side logo-wall-left" />
            <div className="logo-wall-side logo-wall-right" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SnakeAndLadder() {
  useTelegramBackButton();
  const [pos, setPos] = useState(0);
  const [streak, setStreak] = useState(0);
  const [highlight, setHighlight] = useState(null);
  const [message, setMessage] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [pot, setPot] = useState(100);
  const [showInfo, setShowInfo] = useState(false);
  const [{ snakes, ladders }] = useState(() => generateSnakesAndLadders());

  const moveSoundRef = useRef(null);
  const snakeSoundRef = useRef(null);
  const ladderSoundRef = useRef(null);
  const winSoundRef = useRef(null);

  useEffect(() => {
    setPhotoUrl(getTelegramPhotoUrl());
    moveSoundRef.current = new Audio('https://snakes-and-ladders-game.netlify.app/audio/drop.mp3');
    snakeSoundRef.current = new Audio('https://snakes-and-ladders-game.netlify.app/audio/snake.mp3');
    ladderSoundRef.current = new Audio('https://snakes-and-ladders-game.netlify.app/audio/ladder.mp3');
    winSoundRef.current = new Audio('/assets/sounds/successful.mp3');
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

    const rolledSix = Array.isArray(values)
      ? values.includes(6)
      : value === 6;

    setMessage("");
    let newStreak = rolledSix ? streak + 1 : 0;

    if (newStreak === 3) {
      setStreak(0);
      setMessage("Third 6 rolled, turn skipped!");
      return;
    }

    setStreak(newStreak);
    let current = pos;
    let target = current;

    if (current === 0) {
      if (rolledSix) target = 1;
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
            setMessage(`You win ${pot} tokens!`);
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
      moveSoundRef.current.currentTime = 0;
      moveSoundRef.current.play().catch(() => {});
      setHighlight(next);
      setTimeout(() => move(index + 1), 300);
    };

    move(0);
  };

  return (
    <div className="p-4 pb-32 space-y-4 text-text flex flex-col items-center relative w-full">
      <button
        className="absolute top-0 right-0 p-2"
        onClick={() => setShowInfo(true)}
      >
        <AiOutlineInfoCircle className="text-2xl" />
      </button>
      <Board
        position={pos}
        highlight={highlight}
        photoUrl={photoUrl}
        pot={pot}
        snakes={snakes}
        ladders={ladders}
      />
      {message && <div className="text-center font-semibold w-full">{message}</div>}
      <div className="fixed bottom-24 inset-x-0 flex justify-center z-20">
        <DiceRoller onRollEnd={handleRoll} clickable numDice={2} />
      </div>
      <InfoPopup
        open={showInfo}
        onClose={() => setShowInfo(false)}
        title="Snake & Ladder"
        info="Roll the dice to move across the board. Ladders move you up, snakes bring you down. The Pot at the top collects everyone's stake – reach it first to claim the total amount."
      />
    </div>
  );
}
