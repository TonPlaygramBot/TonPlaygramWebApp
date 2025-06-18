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
import { getTelegramId, getTelegramPhotoUrl } from "../../utils/telegram.js";
import { getSnakeBoard, fetchTelegramInfo } from "../../utils/api.js";
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
  snakeOffsets,
  ladderOffsets,
  offsetPopup,
  celebrate,
  token,
  tokenType,
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
      const cellType = ladders[num] ? "ladder" : snakes[num] ? "snake" : "";
      const cellClass = cellType ? `${cellType}-cell` : "";
      const icon = cellType === "ladder" ? "🪜" : cellType === "snake" ? "🐍" : "";
      const offsetVal =
        cellType === "ladder"
          ? ladderOffsets[num]
          : cellType === "snake"
          ? snakeOffsets[num]
          : null;
      tiles.push(
        <div
          key={num}
          data-cell={num}
          className={`board-cell ${cellClass} ${highlightClass}`}
          style={{ gridRowStart: ROWS - r, gridColumnStart: col + 1 }}
        >
          {icon && <span className="cell-icon">{icon}</span>}
          {offsetVal != null && (
            <span className="cell-offset">
              {cellType === "snake" ? "-" : "+"}
              {offsetVal}
            </span>
          )}
          <span className="cell-number">{num}</span>
          {position === num && (
            <PlayerToken
              photoUrl={photoUrl}
              type={isHighlight ? highlight.type : tokenType}
            />
          )}
          {offsetPopup && offsetPopup.cell === num && (
            <span
              className={`popup-offset italic font-bold ${
                offsetPopup.type === 'snake' ? 'text-red-500' : 'text-green-500'
              }`}
            >
              {offsetPopup.type === 'snake' ? '-' : '+'}
              {offsetPopup.amount}
            </span>
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

  // Icons are rendered directly inside each cell so that they stay perfectly
  // aligned with the grid. Previously additional absolutely positioned markers
  // were added which resulted in duplicate icons and misalignment when the
  // board scaled. The markers logic has been removed and the icons are now
  // displayed only once within the cell itself.
  // Dynamically adjust zoom and camera tilt based on how far the player
  // has progressed. This keeps the logo in focus while following the token.
  const FRAME_SWITCH_ROW = 4;
  const VISIBLE_ROWS_BELOW = 2;

  const MIN_ZOOM = 1; // keep the bottom scale fixed
  // Reduce the zoom range so the board does not enlarge as much
  // when approaching the top of the screen.
  const MAX_ZOOM = 1.5;
  const MIN_ANGLE = 65;
  const MAX_ANGLE = 20;

  const rowFromBottom = Math.floor(Math.max(position - 1, 0) / COLS);
  const progress = Math.min(1, Math.min(rowFromBottom, FRAME_SWITCH_ROW) / (ROWS - 1));

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
    if (!cell) return;

    const cRect = container.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();

    if (rowFromBottom < FRAME_SWITCH_ROW) {
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
    } else {
      const baseline =
        container.scrollHeight -
        cRect.height -
        cellHeight * (FRAME_SWITCH_ROW - VISIBLE_ROWS_BELOW);
      const rowDiff = rowFromBottom - FRAME_SWITCH_ROW;
      const target = Math.min(
        container.scrollHeight - cRect.height,
        Math.max(0, baseline + rowDiff * cellHeight),
      );
      container.scrollTo({ top: target, behavior: "smooth" });
    }
  }, [position, cellHeight, rowFromBottom]);

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
            className="snake-board-grid grid gap-1 relative mx-auto"
            style={{
              width: `${cellWidth * COLS}px`,
              height: `${cellHeight * ROWS}px`,
              gridTemplateColumns: `repeat(${COLS}, ${cellWidth}px)`,
              gridTemplateRows: `repeat(${ROWS}, ${cellHeight}px)`,
              "--cell-width": `${cellWidth}px`,
              "--cell-height": `${cellHeight}px`,
              "--board-width": `${cellWidth * COLS}px`,
              "--board-angle": `${angle}deg`,
              // Lower camera angle and zoom dynamically as the player moves
              transform: `rotateX(${angle}deg) scale(${zoom})`,
            }}
          >
            {tiles}
            <div
              className={`pot-cell ${highlight && highlight.cell === FINAL_TILE ? "highlight" : ""}`}
            >
              <span className="font-bold">Pot</span>
              <span className="text-sm">{pot}</span>
              {position === FINAL_TILE && (
                <PlayerToken
                  photoUrl={photoUrl}
                  type={highlight && highlight.cell === FINAL_TILE ? highlight.type : tokenType}
                />
              )}
              {celebrate && <CoinBurst token={token} />}
            </div>
            <div className="logo-wall-main" />
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
  const [tokenType, setTokenType] = useState('normal');
  const [message, setMessage] = useState("");
  const [messageColor, setMessageColor] = useState("");
  const [turnMessage, setTurnMessage] = useState("Your turn");
  const [photoUrl, setPhotoUrl] = useState("");
  const [pot, setPot] = useState(100);
  const [token, setToken] = useState("TPC");
  const [celebrate, setCelebrate] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [snakes, setSnakes] = useState({});
  const [ladders, setLadders] = useState({});
  const [snakeOffsets, setSnakeOffsets] = useState({});
  const [ladderOffsets, setLadderOffsets] = useState({});
  const [offsetPopup, setOffsetPopup] = useState(null); // { cell, type, amount }

  const moveSoundRef = useRef(null);
  const snakeSoundRef = useRef(null);
  const ladderSoundRef = useRef(null);
  const winSoundRef = useRef(null);

  useEffect(() => {
    const id = getTelegramId();
    const url = getTelegramPhotoUrl();
    if (url) {
      setPhotoUrl(url);
    } else if (id) {
      fetchTelegramInfo(id).then((info) => {
        if (info?.photoUrl) setPhotoUrl(info.photoUrl);
      });
    }
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
        const snakeData = data.snakes || {};
        const ladderData = data.ladders || {};

        // Remove any snake that starts on the same tile as a ladder to avoid
        // duplicate icons occupying a single cell.
        const cleanSnakes = {};
        Object.keys(snakeData).forEach((k) => {
          if (!ladderData[k]) cleanSnakes[k] = snakeData[k];
        });

        setSnakes(cleanSnakes);
        setLadders(ladderData);

        const snk = {};
        Object.keys(cleanSnakes).forEach((k) => {
          snk[k] = Math.floor(Math.random() * 10) + 1;
        });
        const lad = {};
        Object.keys(ladderData).forEach((k) => {
          lad[k] = Math.floor(Math.random() * 10) + 1;
        });
        setSnakeOffsets(snk);
        setLadderOffsets(lad);
      })
      .catch(() => {});
  }, []);

  const handleRoll = (values) => {
    setTurnMessage("");
    setOffsetPopup(null);
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

    const moveSeq = (seq, type, done) => {
      const stepMove = (idx) => {
        if (idx >= seq.length) return done();
        const next = seq[idx];
        setPos(next);
        moveSoundRef.current.currentTime = 0;
        moveSoundRef.current.play().catch(() => {});
        setHighlight({ cell: next, type });
        setTimeout(() => stepMove(idx + 1), 300);
      };
      stepMove(0);
    };

    const applyEffect = (startPos) => {
      if (Object.keys(snakes).includes(String(startPos))) {
        const offset = snakeOffsets[startPos] || 0;
        setOffsetPopup({ cell: startPos, type: 'snake', amount: offset });
        setTimeout(() => setOffsetPopup(null), 1000);
        setMessage(`🐍 ${startPos} -${offset}`);
        setMessageColor('text-red-500');
        snakeSoundRef.current?.play().catch(() => {});
        const seq = [];
        for (let i = 1; i <= offset && startPos - i >= 0; i++) seq.push(startPos - i);
        moveSeq(seq, 'snake', () => finalizeMove(Math.max(0, startPos - offset), 'snake'));
      } else if (Object.keys(ladders).includes(String(startPos))) {
        const offset = ladderOffsets[startPos] || 0;
        setOffsetPopup({ cell: startPos, type: 'ladder', amount: offset });
        setTimeout(() => setOffsetPopup(null), 1000);
        setMessage(`🪜 ${startPos} +${offset}`);
        setMessageColor('text-green-500');
        ladderSoundRef.current?.play().catch(() => {});
        const seq = [];
        for (let i = 1; i <= offset && startPos + i <= FINAL_TILE; i++) seq.push(startPos + i);
        moveSeq(seq, 'ladder', () => finalizeMove(Math.min(FINAL_TILE, startPos + offset), 'ladder'));
      } else {
        finalizeMove(startPos, 'normal');
      }
    };

    const finalizeMove = (finalPos, type) => {
      setPos(finalPos);
      setHighlight({ cell: finalPos, type });
      setTokenType(type);
      if (finalPos === FINAL_TILE) {
        setMessage(`You win ${pot} ${token}!`);
        setMessageColor('');
        winSoundRef.current?.play().catch(() => {});
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 1500);
      }
      setTurnMessage('Your turn');
    };

    moveSeq(steps, 'normal', () => applyEffect(target));
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
        snakeOffsets={snakeOffsets}
        ladderOffsets={ladderOffsets}
        offsetPopup={offsetPopup}
        celebrate={celebrate}
        token={token}
        tokenType={tokenType}
      />
      {message && (
        <div className={`text-center font-semibold w-full ${messageColor}`}>{message}</div>
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
