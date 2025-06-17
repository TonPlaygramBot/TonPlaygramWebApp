import { useState, useEffect, useRef } from "react";
import DiceRoller from "../../components/DiceRoller.jsx";
import InfoPopup from "../../components/InfoPopup.jsx";
import {
  AiOutlineInfoCircle,
  AiOutlineLogout,
  AiOutlineRollback,
} from "react-icons/ai";
import useTelegramBackButton from "../../hooks/useTelegramBackButton.js";
import { useNavigate } from "react-router-dom";
import { getTelegramPhotoUrl } from "../../utils/telegram.js";
import { getSnakeBoard } from "../../utils/api.js";
import PlayerToken from "../../components/PlayerToken.jsx";

const PLAYERS = 4;
// Adjusted board dimensions to show five columns
// while keeping the total cell count at 100
const ROWS = 20;
const COLS = 5;
const FINAL_TILE = ROWS * COLS + 1; // 101
// Portion of the viewport to keep below the player's token when scrolling.
// Larger values keep the token closer to the bottom so the board follows
// the user row by row from a fixed camera position.
// Slightly larger offset so the starting row fits in view
const CAMERA_OFFSET = 0.95;

function CoinBurst({ token }) {
  const coins = Array.from({ length: 15 }, () => ({
    dx: (Math.random() - 0.5) * 100,
    delay: Math.random() * 0.3,
    dur: 0.8 + Math.random() * 0.4,
  }));
  return (
    <div className="coin-burst">
      {coins.map((c, i) => (
        <img
          key={i}
          src={`/icons/${token.toLowerCase()}.svg`}
          className="coin-img"
          style={{
            "--dx": `${c.dx}px`,
            "--delay": `${c.delay}s`,
            "--dur": `${c.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

function Board({
  position,
  highlight,
  photoUrl,
  pot,
  snakes,
  ladders,
  celebrate,
  token,
}) {
  const containerRef = useRef(null);
  const tiles = [];

  for (let r = 0; r < ROWS; r++) {
    const reversed = r % 2 === 1;
    for (let c = 0; c < COLS; c++) {
      const col = reversed ? COLS - 1 - c : c;
      const num = r * COLS + col + 1;
      const isHighlight = highlight && highlight.cell === num;
      const highlightClass = isHighlight ? `${highlight.type}-highlight` : "";
      tiles.push(
        <div
          key={num}
          data-cell={num}
          className={`board-cell ${highlightClass}`}
          style={{ gridRowStart: ROWS - r, gridColumnStart: col + 1 }}
        >
          {num}
          {/* ladder markers removed */}
          {position === num && (
            <PlayerToken
              photoUrl={photoUrl}
              type={isHighlight ? highlight.type : 'normal'}
              indicator={num}
            />
          )}
        </div>,
      );
    }
  }

  // Scale board based on viewport width so it fills the screen.
  const [cellWidth, setCellWidth] = useState(80);
  const [cellHeight, setCellHeight] = useState(40);

  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      const cw = Math.floor(width / COLS);
      setCellWidth(cw);
      setCellHeight(Math.floor(cw / 2));
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

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

  const renderConnector = (from, to, type, width) => {
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
          "--rail-width": width ? `${width}px` : undefined,
        }}
      />
    );
  };

  for (const [s, e] of Object.entries(ladders)) {
    const end = typeof e === "object" ? e.end : e;
    const width = typeof e === "object" ? e.width : undefined;
    connectors.push(renderConnector(Number(s), Number(end), "ladder", width));
  }
  for (const [s, e] of Object.entries(snakes)) {
    connectors.push(renderConnector(Number(s), Number(e), "snake"));
  }
  // Dynamically adjust zoom and camera tilt based on how far the player
  // has progressed. This keeps the logo in focus while following the token.
  const MIN_ZOOM = 0.9; // board slightly smaller at the bottom
  const MAX_ZOOM = 1.5; // and larger when reaching the top
  const MIN_ANGLE = 65;
  const MAX_ANGLE = 40;

  const rowFromBottom = Math.floor(Math.max(position - 1, 0) / COLS);
  const progress = Math.min(1, rowFromBottom / (ROWS - 1));

  const zoom = MIN_ZOOM + (MAX_ZOOM - MIN_ZOOM) * progress;
  const angle = MIN_ANGLE - (MIN_ANGLE - MAX_ANGLE) * progress;

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
        cellRect.top -
        cRect.top -
        cRect.height * CAMERA_OFFSET +
        cellRect.height / 2;
      const target = Math.min(
        container.scrollHeight - cRect.height,
        Math.max(0, container.scrollTop + offset),
      );
      container.scrollTo({ top: target, behavior: "smooth" });
    }
  }, [position]);

  return (
    <div className="flex justify-center items-center w-screen overflow-hidden">
      <div
        ref={containerRef}
        className="overflow-y-auto overflow-x-hidden"
        style={{
          height: "80vh",
          overscrollBehaviorY: "contain",
          paddingTop: "0.5rem",
        }}
      >
        <div className="snake-board-tilt">
          <div
            className="snake-board-grid grid gap-1 relative"
            style={{
              width: `${cellWidth * COLS}px`,
              height: `${cellHeight * ROWS}px`,
              gridTemplateColumns: `repeat(${COLS}, ${cellWidth}px)`,
              gridTemplateRows: `repeat(${ROWS}, ${cellHeight}px)`,
              "--cell-width": `${cellWidth}px`,
              "--cell-height": `${cellHeight}px`,
              "--board-width": `${cellWidth * COLS}px`,
              // Lower camera angle and zoom dynamically as the player moves
              transform: `rotateX(${angle}deg) scale(${zoom})`,
            }}
          >
            {tiles}
            {connectors}
            <div
              className={`pot-cell ${highlight && highlight.cell === FINAL_TILE ? "highlight" : ""}`}
            >
              <span className="font-bold">Pot</span>
              <span className="text-sm">{pot}</span>
              {position === FINAL_TILE && (
                <PlayerToken
                  photoUrl={photoUrl}
                  type={highlight && highlight.cell === FINAL_TILE ? highlight.type : 'normal'}
                  indicator={FINAL_TILE}
                />
              )}
              {celebrate && <CoinBurst token={token} />}
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
  const navigate = useNavigate();
  const [pos, setPos] = useState(0);
  const [streak, setStreak] = useState(0);
  const [highlight, setHighlight] = useState(null); // { cell: number, type: string }
  const [message, setMessage] = useState("");
  const [turnMessage, setTurnMessage] = useState("Your turn");
  const [photoUrl, setPhotoUrl] = useState("");
  const [pot, setPot] = useState(100);
  const [token, setToken] = useState("TPC");
  const [celebrate, setCelebrate] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [snakes, setSnakes] = useState({});
  const [ladders, setLadders] = useState({});

  const moveSoundRef = useRef(null);
  const snakeSoundRef = useRef(null);
  const ladderSoundRef = useRef(null);
  const winSoundRef = useRef(null);

  useEffect(() => {
    setPhotoUrl(getTelegramPhotoUrl());
    moveSoundRef.current = new Audio(
      "https://snakes-and-ladders-game.netlify.app/audio/drop.mp3",
    );
    snakeSoundRef.current = new Audio(
      "https://snakes-and-ladders-game.netlify.app/audio/snake.mp3",
    );
    ladderSoundRef.current = new Audio(
      "https://snakes-and-ladders-game.netlify.app/audio/ladder.mp3",
    );
    winSoundRef.current = new Audio("/assets/sounds/successful.mp3");
    return () => {
      moveSoundRef.current?.pause();
      snakeSoundRef.current?.pause();
      ladderSoundRef.current?.pause();
      winSoundRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("table") || "snake-4";
    const t = params.get("token");
    const amt = params.get("amount");
    if (t) setToken(t.toUpperCase());
    if (amt) setPot(Number(amt));
    getSnakeBoard(room)
      .then((data) => {
        setSnakes(data.snakes || {});
        setLadders(data.ladders || {});
      })
      .catch(() => {});
  }, []);

  const handleRoll = (values) => {
    setTurnMessage("");
    const value = Array.isArray(values)
      ? values.reduce((a, b) => a + b, 0)
      : values;

    const rolledSix = Array.isArray(values) ? values.includes(6) : value === 6;

    setMessage("");
    let newStreak = rolledSix ? streak + 1 : 0;

    if (newStreak === 3) {
      setStreak(0);
      setMessage("Third 6 rolled, turn skipped!");
      setTurnMessage("Your turn");
      return;
    }

    setStreak(newStreak);
    let current = pos;
    let target = current;

    if (current === 0) {
      if (rolledSix) target = 1;
      else {
        setMessage("Need a 6 to start!");
        setTurnMessage("Your turn");
        return;
      }
    } else if (current + value <= FINAL_TILE) {
      target = current + value;
    } else {
      setMessage("Need exact roll!");
      setTurnMessage("Your turn");
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
            setMessage(`You win ${pot} ${token}!`);
            winSoundRef.current?.play().catch(() => {});
            setCelebrate(true);
            setTimeout(() => setCelebrate(false), 1500);
          } else if (ladder) {
            ladderSoundRef.current?.play().catch(() => {});
            setMessage(`Ladder! Climb to tile ${finalPos}`);
          } else if (snake) {
            snakeSoundRef.current?.play().catch(() => {});
            setMessage(`Snake! Slide to tile ${finalPos}`);
          }
          setTurnMessage("Your turn");
        }, 300);
        return;
      }

      const next = steps[index];
      setPos(next);
      moveSoundRef.current.currentTime = 0;
      moveSoundRef.current.play().catch(() => {});
      const type = ladders[next] ? "ladder" : snakes[next] ? "snake" : "normal";
      setHighlight({ cell: next, type });
      setTimeout(() => move(index + 1), 300);
    };

    move(0);
  };

  return (
    <div className="p-4 pb-32 space-y-4 text-text flex flex-col items-center relative w-full">
      <div className="absolute top-0 -right-2 flex flex-col items-end space-y-2 p-2 z-20">
        <button onClick={() => setShowInfo(true)} className="p-2 flex flex-col items-center">
          <AiOutlineInfoCircle className="text-2xl" />
          <span className="text-xs">Info</span>
        </button>
        <button
          onClick={() => navigate('/games')}
          className="p-2 flex flex-col items-center"
        >
          <AiOutlineLogout className="text-xl" />
          <span className="text-xs">Exit</span>
        </button>
        <button
          onClick={() => navigate('/games/snake/lobby')}
          className="p-2 flex flex-col items-center"
        >
          <AiOutlineRollback className="text-xl" />
          <span className="text-xs">Lobby</span>
        </button>
        {turnMessage && (
          <div className="text-xs font-semibold text-right w-full">{turnMessage}</div>
        )}
      </div>
      <Board
        position={pos}
        highlight={highlight}
        photoUrl={photoUrl}
        pot={pot}
        snakes={snakes}
        ladders={ladders}
        celebrate={celebrate}
        token={token}
      />
      {message && (
        <div className="text-center font-semibold w-full">{message}</div>
      )}
      <div className="fixed bottom-24 inset-x-0 flex justify-center z-20">
        <DiceRoller
          onRollEnd={handleRoll}
          onRollStart={() => setTurnMessage('Rolling...')}
          clickable
          numDice={2}
        />
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
