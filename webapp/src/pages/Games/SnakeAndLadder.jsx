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

function CoinBurst({ token }) {
  const coins = Array.from({ length: 30 }, () => ({
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
  trail,
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
  const [cellWidth, setCellWidth] = useState(80);
  const [cellHeight, setCellHeight] = useState(40);
  const tiles = [];
  const centerCol = (COLS - 1) / 2;
  // Keep vertical columns evenly spaced rather than widening
  const widenStep = 0; // how much each row expands horizontally
  const scaleStep = 0.02; // how much each row's cells scale
  const finalScale = 1 + (ROWS - 3) * scaleStep;

  // Precompute vertical offsets so that the gap between rows
  // stays uniform even as cells are scaled differently per row.
  const rowOffsets = [0];
  for (let r = 1; r < ROWS; r++) {
    const prevScale = 1 + (r - 1 - 2) * scaleStep;
    rowOffsets[r] = rowOffsets[r - 1] + (prevScale - 1) * cellHeight;
  }
  const offsetYMax = rowOffsets[ROWS - 1];

  for (let r = 0; r < ROWS; r++) {
    // Allow negative rowFactor so the bottom rows appear slightly smaller
    const rowFactor = r - 2;
    const scale = 1 + rowFactor * scaleStep;
    // Include the scaled cell width so horizontal gaps remain consistent
    const offsetX = rowFactor * widenStep * cellWidth + (scale - 1) * cellWidth;
    // Arrange cell numbers so the bottom row starts on the left and each
    // subsequent row alternates direction. Tile 1 is at the bottom-left and
    // tile 100 ends up at the top-right.
    const reversed = r % 2 === 1;
    for (let c = 0; c < COLS; c++) {
      const col = c;
      const num = reversed ? (r + 1) * COLS - c : r * COLS + c + 1;
      const translateX = (col - centerCol) * offsetX;
      const translateY = -rowOffsets[r];
      const isHighlight = highlight && highlight.cell === num;
      const trailHighlight = trail?.find((t) => t.cell === num);
      const highlightClass = isHighlight
        ? `${highlight.type}-highlight`
        : trailHighlight
        ? `${trailHighlight.type}-highlight`
        : "";
      const isJump = isHighlight && highlight.type === 'normal';
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
          style={{
            gridRowStart: ROWS - r,
            gridColumnStart: col + 1,
            transform: `translate(${translateX}px, ${translateY}px) scale(${scale}) translateZ(5px)`,
            transformOrigin: 'bottom center',
          }}
        >
          {(icon || offsetVal != null) && (
            <span className="cell-marker">
              {icon && <span className="cell-icon">{icon}</span>}
              {offsetVal != null && (
                <span className="cell-offset">
                  {cellType === "snake" ? "-" : "+"}
                  {offsetVal}
                </span>
              )}
            </span>
          )}
          <span className="cell-number">{num}</span>
          {position === num && (
            <PlayerToken
              photoUrl={photoUrl}
              type={isHighlight ? highlight.type : tokenType}
              className={isJump ? 'jump' : ''}
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

  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      const cw = Math.floor(width / COLS);
      setCellWidth(cw);
      const ch = Math.floor(cw / 2);
      setCellHeight(ch);
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
  // Fixed board angle with no zoom
  // Lowered camera angle so the logo touches the top of the screen
  const angle = 60;
  // Small horizontal offset so the board sits perfectly centered
  const boardXOffset = -10; // pixels

  useEffect(() => {
    const container = containerRef.current;
    if (container)
      container.scrollTop = container.scrollHeight - container.clientHeight;
  }, []);

  // When the player moves beyond the first two rows, keep the
  // camera locked to the same relative frame by scrolling the
  // container instead of changing angle or zoom.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const row = Math.floor((position - 1) / COLS);
    if (row < 2) {
      container.scrollTop = container.scrollHeight - container.clientHeight;
      return;
    }
    const cell = container.querySelector(`[data-cell="${position}"]`);
    if (cell) {
      const offset = cell.offsetTop - cellHeight * 2;
      const target = Math.min(
        Math.max(0, offset),
        container.scrollHeight - container.clientHeight,
      );
      container.scrollTo({ top: target, behavior: 'smooth' });
    }
  }, [position, cellHeight]);

  // The board is initially positioned at the bottom. Once the player
  // reaches the third row, the container scrolls to keep them in view
  // without altering the camera angle or zoom.

  const paddingTop = `${5.5 * cellHeight}px`;

  return (
    <div className="flex justify-center items-center w-screen overflow-hidden">
      <div
        ref={containerRef}
        className="overflow-y-auto"
        style={{
          overflowX: 'hidden',
          height: "80vh",
          overscrollBehaviorY: "contain",
          paddingTop,
        }}
      >
        <div className="snake-board-tilt">
          <div
            className="snake-board-grid grid gap-1 relative mx-auto"
            style={{
              width: `${cellWidth * COLS}px`,
              height: `${cellHeight * ROWS + offsetYMax}px`,
              gridTemplateColumns: `repeat(${COLS}, ${cellWidth}px)`,
              gridTemplateRows: `repeat(${ROWS}, ${cellHeight}px)`,
              "--cell-width": `${cellWidth}px`,
              "--cell-height": `${cellHeight}px`,
              "--board-width": `${cellWidth * COLS}px`,
              "--board-angle": `${angle}deg`,
              "--final-scale": finalScale,
              // Fixed camera angle with no zooming
              transform: `translateX(${boardXOffset}px) rotateX(${angle}deg)`,
            }}
          >
            {tiles}
            <div
              className={`pot-cell ${highlight && highlight.cell === FINAL_TILE ? "highlight" : ""}`}
            >
              <PlayerToken color="#0d47a1" className="pot-token" />
              <img
                src={`/icons/${token.toLowerCase()}.svg`}
                alt="pot token"
                className="pot-icon"
              />
              <div className={`coin-stack ${celebrate ? 'invisible' : ''}`}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <img
                    key={i}
                    src={`/icons/${token.toLowerCase()}.svg`}
                    className="coin-stack-img"
                    style={{ bottom: `${i * 3}px` }}
                  />
                ))}
              </div>
              <span className="text-sm mt-1">{pot}</span>
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
  const [trail, setTrail] = useState([]);
  const [tokenType, setTokenType] = useState('normal');
  const [message, setMessage] = useState("");
  const [messageColor, setMessageColor] = useState("");
  const [turnMessage, setTurnMessage] = useState("Your turn");
  const [diceVisible, setDiceVisible] = useState(true);
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
    setDiceVisible(false);
    setOffsetPopup(null);
    setTrail([]);
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
      setDiceVisible(true);
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
        setDiceVisible(true);
        return;
      }
    } else if (current + value <= FINAL_TILE) {
      target = current + value;
    } else {
      setMessage("Need exact roll!");
      setTurnMessage("Your turn");
      setDiceVisible(true);
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
        setTrail((t) => [...t, { cell: next, type }]);
        setHighlight({ cell: next, type });
        setTimeout(() => stepMove(idx + 1), 700);
      };
      stepMove(0);
    };

    const flashHighlight = (cell, type, times, done) => {
      if (times <= 0) return done();
      setHighlight({ cell, type });
      setTimeout(() => {
        setHighlight(null);
        setTimeout(() => flashHighlight(cell, type, times - 1, done), 150);
      }, 150);
    };

    const applyEffect = (startPos) => {
      if (Object.keys(snakes).includes(String(startPos))) {
        setTrail((t) =>
          t.map((h) => (h.cell === startPos ? { ...h, type: 'snake' } : h)),
        );
        const offset = snakeOffsets[startPos] || 0;
        setOffsetPopup({ cell: startPos, type: 'snake', amount: offset });
        setTimeout(() => setOffsetPopup(null), 1000);
        setMessage(`🐍 ${startPos} -${offset}`);
        setMessageColor('text-red-500');
        snakeSoundRef.current?.play().catch(() => {});
        const seq = [];
        for (let i = 1; i <= offset && startPos - i >= 0; i++) seq.push(startPos - i);
        const move = () =>
          moveSeq(seq, 'snake', () => finalizeMove(Math.max(0, startPos - offset), 'snake'));
        flashHighlight(startPos, 'snake', 2, move);
      } else if (Object.keys(ladders).includes(String(startPos))) {
        setTrail((t) =>
          t.map((h) => (h.cell === startPos ? { ...h, type: 'ladder' } : h)),
        );
        const offset = ladderOffsets[startPos] || 0;
        setOffsetPopup({ cell: startPos, type: 'ladder', amount: offset });
        setTimeout(() => setOffsetPopup(null), 1000);
        setMessage(`🪜 ${startPos} +${offset}`);
        setMessageColor('text-green-500');
        ladderSoundRef.current?.play().catch(() => {});
        const seq = [];
        for (let i = 1; i <= offset && startPos + i <= FINAL_TILE; i++) seq.push(startPos + i);
        const move = () =>
          moveSeq(seq, 'ladder', () => finalizeMove(Math.min(FINAL_TILE, startPos + offset), 'ladder'));
        flashHighlight(startPos, 'ladder', 2, move);
      } else {
        finalizeMove(startPos, 'normal');
      }
    };

    const finalizeMove = (finalPos, type) => {
      setPos(finalPos);
      setHighlight({ cell: finalPos, type });
      setTrail([]);
      setTokenType(type);
      setTimeout(() => setHighlight(null), 300);
      if (finalPos === FINAL_TILE) {
        setMessage(`You win ${pot} ${token}!`);
        setMessageColor('');
        winSoundRef.current?.play().catch(() => {});
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 1500);
      }
      setTurnMessage('Your turn');
      setDiceVisible(true);
    };

    moveSeq(steps, 'normal', () => applyEffect(target));
  };

  return (
    <div className="p-4 pb-32 space-y-4 text-text flex flex-col justify-end items-center relative w-full flex-grow">
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
      </div>
      <Board
        position={pos}
        highlight={highlight}
        trail={trail}
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
      {diceVisible && (
        <div className="fixed bottom-24 inset-x-0 flex flex-col items-center z-20">
          <DiceRoller
            onRollEnd={handleRoll}
            onRollStart={() => setTurnMessage('Rolling...')}
            clickable
            numDice={2}
          />
          {turnMessage && (
            <div className="mt-2 text-sm font-semibold">{turnMessage}</div>
          )}
        </div>
      )}
      <InfoPopup
        open={showInfo}
        onClose={() => setShowInfo(false)}
        title="Snake & Ladder"
        info="Roll the dice to move across the board. Ladders move you up, snakes bring you down. The Pot at the top collects everyone's stake – reach it first to claim the total amount."
      />
    </div>
  );
}
