import { useState, useEffect, useRef, useLayoutEffect } from "react";
import confetti from "canvas-confetti";
import DiceRoller from "../../components/DiceRoller.jsx";
import { dropSound, snakeSound, ladderSound, timerBeep, bombSound } from "../../assets/soundData.js";
import { AVATARS } from "../../components/AvatarPickerModal.jsx";
import InfoPopup from "../../components/InfoPopup.jsx";
import GameEndPopup from "../../components/GameEndPopup.jsx";
import {
  AiOutlineInfoCircle,
  AiOutlineLogout,
  AiOutlineRollback,
  AiOutlineReload,
} from "react-icons/ai";
import useTelegramBackButton from "../../hooks/useTelegramBackButton.js";
import { useNavigate } from "react-router-dom";
import { getTelegramId, getTelegramPhotoUrl } from "../../utils/telegram.js";
import { fetchTelegramInfo, getProfile, deposit } from "../../utils/api.js";
import PlayerToken from "../../components/PlayerToken.jsx";
import AvatarTimer from "../../components/AvatarTimer.jsx";
import ConfirmPopup from "../../components/ConfirmPopup.jsx";
import TileFrame from "../../components/TileFrame.jsx";

const TOKEN_COLORS = [
  { name: "blue", color: "#60a5fa" },
  { name: "red", color: "#ef4444" },
  { name: "green", color: "#4ade80" },
  { name: "yellow", color: "#facc15" },
];

const PLAYERS = 4;
// Adjusted board dimensions to show five columns
// while keeping the total cell count at 100
const ROWS = 20;
const COLS = 5;
const FINAL_TILE = ROWS * COLS + 1; // 101

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

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
  players = [],
  highlight,
  trail,
  pot,
  snakes,
  ladders,
  snakeOffsets,
  ladderOffsets,
  offsetPopup,
  celebrate,
  token,
  tokenType,
  diceCells,
  rollingIndex,
  currentTurn,
  timerPct,
  burning = [],
}) {
  const containerRef = useRef(null);
  const gridRef = useRef(null);
  const tile1Ref = useRef(null);
  const [connectors, setConnectors] = useState([]);
  const [cellWidth, setCellWidth] = useState(80);
  const [cellHeight, setCellHeight] = useState(40);
  const [tileRect, setTileRect] = useState(null);
  const adjustX = 0;
  const adjustY = 0;
  useEffect(() => {
    if (tileRect) console.log(tileRect);
  }, [tileRect]);
  const tiles = [];
  const centerCol = (COLS - 1) / 2;
  // Gradual horizontal widening towards the top. Keep the bottom
  // row the same width and slightly expand each successive row so
  // the board forms a soft V shape.
  const widenStep = 0.05; // how much each row expands horizontally
  const scaleStep = 0.02; // how much each row's cells scale
  // Perspective with smaller cells at the bottom growing larger towards the pot
  const finalScale = 1 + (ROWS - 3) * scaleStep;

  // Precompute vertical offsets so that the gap between rows
  // stays uniform even as cells are scaled differently per row.
  const rowOffsets = [0];
  for (let r = 1; r < ROWS; r++) {
    const prevScale = 1 + (r - 3) * scaleStep;
    rowOffsets[r] = rowOffsets[r - 1] + (prevScale - 1) * cellHeight;
  }
  const offsetYMax = rowOffsets[ROWS - 1];

  for (let r = 0; r < ROWS; r++) {
    // Rows grow larger towards the top of the board
    const rowFactor = r - 2;
    const scale = 1 + rowFactor * scaleStep;
    // Normalised row position from bottom (0) to top (1)
    const rowPos = r / (ROWS - 1);
    // Slightly widen higher rows without affecting the bottom row
    const scaleX = scale * (1 + rowPos * widenStep);
    // Include the scaled cell width so horizontal gaps remain consistent
    const offsetX = (scaleX - 1) * cellWidth;
    // Arrange cell numbers so the bottom row starts on the left and each
    // subsequent row alternates direction. Tile 1 is at the bottom-left and
    // tile 100 ends up at the top-right.
    const reversed = r % 2 === 1;
    const colorIdx = Math.floor(r / (ROWS / 5));
    const TILE_COLORS = ["#6db0ad", "#4a828e", "#3d7078", "#2d5c66", "#0e3b45"];
    const rowColor = TILE_COLORS[colorIdx] || "#0e3b45";

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
      const isJump = isHighlight && highlight.type === "normal";
      const cellType = ladders[num]
        ? "ladder"
        : snakes[num]
          ? "snake"
          : diceCells && diceCells[num]
            ? "dice"
            : "";
      const cellClass = cellType ? `${cellType}-cell` : "";
      const icon =
        cellType === "ladder" ? "🪜" : cellType === "snake" ? "🐍" : "";
      const offsetVal =
        cellType === "ladder"
          ? ladderOffsets[num]
          : cellType === "snake"
            ? snakeOffsets[num]
            : null;
      const style = {
        gridRowStart: ROWS - r,
        gridColumnStart: col + 1,
        transform: `translate(${translateX}px, ${translateY}px) scaleX(${scaleX}) scaleY(${scale}) translateZ(5px)`,
        transformOrigin: "bottom center",
      };
      if (!highlightClass) style.backgroundColor = rowColor;

      tiles.push(
        <div
          key={num}
          data-cell={num}
          ref={num === 1 ? tile1Ref : null}
          className={`board-cell ${cellClass} ${highlightClass}`}
          style={style}
        >
          {(icon || offsetVal != null) && (
            <span className="cell-marker">
              {icon && <span className="cell-icon">{icon}</span>}
              {offsetVal != null && (
                <span className="cell-offset">
                  <span className={`cell-sign ${cellType}`}>
                    {cellType === "snake" ? "-" : "+"}
                  </span>
                  <span className="cell-value">{offsetVal}</span>
                </span>
              )}
            </span>
          )}
          {num === 1 && <div className="start-hexagon" />}
          {cellType === "" && <span className="cell-number">{num}</span>}
          {diceCells && diceCells[num] && (
            <span className="dice-marker">
              <img src="/assets/icons/dice.svg" alt="dice" />
              <span className="dice-value">
                <span className="dice-sign">+</span>
                <span className="dice-number">{diceCells[num]}</span>
              </span>
            </span>
          )}
          {players
            .map((p, i) => ({ ...p, index: i }))
            .filter((p) => p.position !== 0 && p.position === num)
            .map((p) => (
              <PlayerToken
                key={p.index}
                photoUrl={p.photoUrl}
                type={p.type || (p.index === 0 ? (isHighlight ? highlight.type : tokenType) : "normal")}
                color={p.color}
                rolling={p.index === rollingIndex}
                active={p.index === currentTurn}
                timerPct={p.index === currentTurn ? timerPct : 1}
                className={
                  (p.position === 0
                    ? "start"
                    : p.index === 0 && isJump
                      ? "jump"
                      : "") +
                  (burning.includes(p.index) ? " burning" : "")
                }
              />
            ))}
          {offsetPopup && offsetPopup.cell === num && (
            <span
              className={`popup-offset italic font-bold ${
                offsetPopup.type === "snake" ? "text-red-500" : "text-green-500"
              }`}
            >
              {offsetPopup.type === "snake" ? "-" : "+"}
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
      // Make each cell slightly taller while keeping spacing consistent
      const ch = Math.floor(cw / 1.7);
      setCellHeight(ch);
      if (tile1Ref.current && containerRef.current) {
        const { left, top, width: w, height: h } = tile1Ref.current.getBoundingClientRect();
        const { left: cl, top: ct } = containerRef.current.getBoundingClientRect();
        setTileRect({ x: left + w / 2 - cl, y: top + h / 2 - ct, width: w, height: h });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useLayoutEffect(() => {
    if (tile1Ref.current && containerRef.current) {
      const { left, top, width, height } = tile1Ref.current.getBoundingClientRect();
      const { left: cl, top: ct } = containerRef.current.getBoundingClientRect();
      setTileRect({ x: left + width / 2 - cl, y: top + height / 2 - ct, width, height });
    }
  }, [cellWidth, cellHeight]);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const posFor = (cell) => {
      const el = grid.querySelector(`[data-cell='${cell}']`);
      if (!el) return null;
      return {
        x: el.offsetLeft + el.offsetWidth / 2,
        y: el.offsetTop + el.offsetHeight / 2,
      };
    };

    const conns = [];
    Object.entries(snakes || {}).forEach(([s, e]) => {
      const start = posFor(Number(s));
      const end = posFor(Number(e));
      if (!start || !end) return;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      conns.push({
        type: 'snake',
        x: start.x,
        y: start.y,
        len: Math.sqrt(dx * dx + dy * dy),
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      });
    });
    Object.entries(ladders || {}).forEach(([s, e]) => {
      const endCell = typeof e === 'object' ? e.end : e;
      const start = posFor(Number(s));
      const end = posFor(Number(endCell));
      if (!start || !end) return;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      conns.push({
        type: 'ladder',
        x: start.x,
        y: start.y,
        len: Math.sqrt(dx * dx + dy * dy),
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      });
    });
    setConnectors(conns);
  }, [cellWidth, cellHeight, snakes, ladders]);

  // Icons are rendered directly inside each cell so that they stay perfectly
  // aligned with the grid. Previously additional absolutely positioned markers
  // were added which resulted in duplicate icons and misalignment when the
  // board scaled. The markers logic has been removed and the icons are now
  // displayed only once within the cell itself.
  // Fixed board angle with no zoom
  // Lowered camera angle so the logo touches the top of the screen
  // Tilt angle for the entire board in 3D space
  const angle = 58; // set board tilt to 58 degrees
  // Small horizontal offset so the board sits perfectly centered
  const boardXOffset = 0; // pixels - center horizontally
  // Lift the board slightly so the bottom row stays visible. Lowered slightly
  // so the logo at the top of the board isn't cropped off screen. Zeroing this
  // aligns the board vertically with the frame.
  const boardYOffset = 0; // pixels
  // Pull the board away from the camera without changing the angle or zoom
  const boardZOffset = -50; // pixels

  // How many board rows to scroll back from the starting position so
  // the bottom row remains in view. Set to 0 to begin at the very first row
  // without shifting the camera upward.
  // Pull the camera back slightly so the first row is visible when the
  // game starts. Using a positive offset scrolls up a couple of rows
  // from the very bottom of the board.
  // Start the camera at the very bottom of the board so the first row is
  // visible without any manual scrolling. This keeps two additional rows
  // in view above it so players immediately see the starting area.
  const CAMERA_OFFSET_ROWS = 0;

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      const target =
        container.scrollHeight -
        container.clientHeight -
        CAMERA_OFFSET_ROWS * cellHeight;
      container.scrollTop = Math.max(0, target);
    }
  }, [cellHeight]);

  // Once positioned the camera remains fixed so it no longer follows the
  // player's token. Manual scrolling is still possible to inspect other rows.

  // Remove the extra top padding so the first row is immediately visible
  const paddingTop = 0;
  const paddingBottom = '15vh';

  return (
    <div className="relative flex justify-center items-center w-screen overflow-visible">
      <div
        ref={containerRef}
        className="overflow-y-auto"
        style={{
          overflowX: "hidden",
          height: "100vh",
          overscrollBehaviorY: "contain",
          paddingTop,
          paddingBottom,
        }}
      >
        <div className="snake-board-tilt">
          <div
            ref={gridRef}
            className="snake-board-grid grid gap-x-1 gap-y-2 relative mx-auto"
            style={{
              width: `${cellWidth * COLS}px`,
              height: `${cellHeight * ROWS + offsetYMax}px`,
              gridTemplateColumns: `repeat(${COLS}, ${cellWidth}px)`,
              gridTemplateRows: `repeat(${ROWS}, ${cellHeight}px)`,
              "--cell-width": `${cellWidth}px`,
              "--cell-height": `${cellHeight}px`,
              "--board-width": `${cellWidth * COLS}px`,
              "--board-height": `${cellHeight * ROWS + offsetYMax}px`,
              "--board-angle": `${angle}deg`,
              "--final-scale": finalScale,
              // Fixed camera angle with no zooming
              // Pull the board slightly back so more of the lower rows are
              // visible when the game starts without changing zoom or angle
              transform: `translate(${boardXOffset}px, ${boardYOffset}px) translateZ(${boardZOffset}px) rotateX(${angle}deg) scale(0.9)`,
            }}
          >
            <div className="snake-gradient-bg" />
            {connectors.map((c, i) => (
              <div
                key={i}
                className={`${c.type}-connector`}
                style={{
                  left: `${c.x}px`,
                  top: `${c.y}px`,
                  width: `${c.len}px`,
                  transform: `translateY(-50%) rotate(${c.angle}deg) translateZ(6px)`,
                }}
              />
            ))}
            {tiles}
            <div
              className={`pot-cell ${highlight && highlight.cell === FINAL_TILE ? "highlight" : ""}`}
            >
              <PlayerToken
                color="#16a34a"
                topColor="#ff0000"
                className="pot-token"
              />
              {players
                .map((p, i) => ({ ...p, index: i }))
                .filter((p) => p.position === FINAL_TILE)
                .map((p) => (
                  <PlayerToken
                    key={`win-${p.index}`}
                    photoUrl={p.photoUrl}
                    type={p.type || 'normal'}
                    color={p.color}
                  />
                ))}
              {celebrate && <CoinBurst token={token} />}
            </div>
            <div className="logo-wall-main" />
          </div>
        </div>
      </div>
      <TileFrame rect={tileRect} adjustX={adjustX} adjustY={adjustY} />
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
  const [tokenType, setTokenType] = useState("normal");
  const [message, setMessage] = useState("");
  const [messageColor, setMessageColor] = useState("");
  const [turnMessage, setTurnMessage] = useState("Your turn");
  const [diceVisible, setDiceVisible] = useState(true);
  const [photoUrl, setPhotoUrl] = useState("");
  const [pot, setPot] = useState(101);
  const [token, setToken] = useState("TPC");
  const [celebrate, setCelebrate] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showLobbyConfirm, setShowLobbyConfirm] = useState(false);
  const [snakes, setSnakes] = useState({});
  const [ladders, setLadders] = useState({});
  const [snakeOffsets, setSnakeOffsets] = useState({});
  const [ladderOffsets, setLadderOffsets] = useState({});
  const [offsetPopup, setOffsetPopup] = useState(null); // { cell, type, amount }
  const [rollResult, setRollResult] = useState(null);
  const [diceCells, setDiceCells] = useState({});
  const [bonusDice, setBonusDice] = useState(0);
  const [diceCount, setDiceCount] = useState(2);
  const [gameOver, setGameOver] = useState(false);
  const [ai, setAi] = useState(0);
  const [aiPositions, setAiPositions] = useState([]);
  const [playerColors, setPlayerColors] = useState([]);
  const [currentTurn, setCurrentTurn] = useState(0); // 0 = player
  const [ranking, setRanking] = useState([]);
  const [turnOrder, setTurnOrder] = useState([]);
  const [initialRolls, setInitialRolls] = useState([]);
  const [setupPhase, setSetupPhase] = useState(true);
  const [aiRollingIndex, setAiRollingIndex] = useState(null);
  const [aiRollTrigger, setAiRollTrigger] = useState(0);
  const [rollingIndex, setRollingIndex] = useState(null);
  const [playerRollTrigger, setPlayerRollTrigger] = useState(0);
  const [playerAutoRolling, setPlayerAutoRolling] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const [aiAvatars, setAiAvatars] = useState([]);
  const [burning, setBurning] = useState([]); // indices of tokens burning

  const playerName = (idx) => (
    <span style={{ color: playerColors[idx] }}>
      {idx === 0 ? 'You' : `AI ${idx}`}
    </span>
  );

  const capturePieces = (cell, mover) => {
    const victims = [];
    if (mover !== 0 && pos === cell) victims.push(0);
    aiPositions.forEach((p, i) => {
      const idx = i + 1;
      if (idx !== mover && p === cell) victims.push(idx);
    });
    if (victims.length) {
      bombSoundRef.current?.play().catch(() => {});
      victims.forEach((idx) => {
        setBurning((b) => [...b, idx]);
        setTimeout(() => {
          setBurning((b) => b.filter((v) => v !== idx));
          if (idx === 0) setPos(0);
          else setAiPositions((arr) => {
            const copy = [...arr];
            copy[idx - 1] = 0;
            return copy;
          });
        }, 1000);
      });
    }
  };

  const moveSoundRef = useRef(null);
  const snakeSoundRef = useRef(null);
  const ladderSoundRef = useRef(null);
  const winSoundRef = useRef(null);
  const diceRewardSoundRef = useRef(null);
  const bombSoundRef = useRef(null);
  const timerSoundRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const id = getTelegramId();
    getProfile(id)
      .then((p) => {
        if (p?.photo) {
          setPhotoUrl(p.photo);
        } else {
          const url = getTelegramPhotoUrl();
          if (url) {
            setPhotoUrl(url);
          } else {
            fetchTelegramInfo(id).then((info) => {
              if (info?.photoUrl) setPhotoUrl(info.photoUrl);
            });
          }
        }
      })
      .catch(() => {
        const url = getTelegramPhotoUrl();
        if (url) {
          setPhotoUrl(url);
        } else {
          fetchTelegramInfo(id).then((info) => {
            if (info?.photoUrl) setPhotoUrl(info.photoUrl);
          });
        }
      });
    moveSoundRef.current = new Audio(dropSound);
    snakeSoundRef.current = new Audio(snakeSound);
    ladderSoundRef.current = new Audio(ladderSound);
    winSoundRef.current = new Audio("/assets/sounds/successful.mp3");
    diceRewardSoundRef.current = new Audio("/assets/sounds/successful.mp3");
    bombSoundRef.current = new Audio(bombSound);
    timerSoundRef.current = new Audio(timerBeep);
    return () => {
      moveSoundRef.current?.pause();
      snakeSoundRef.current?.pause();
      ladderSoundRef.current?.pause();
      winSoundRef.current?.pause();
      diceRewardSoundRef.current?.pause();
      bombSoundRef.current?.pause();
      timerSoundRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    const updatePhoto = () => {
      const id = getTelegramId();
      getProfile(id)
        .then((p) => setPhotoUrl(p?.photo || getTelegramPhotoUrl()))
        .catch(() => setPhotoUrl(getTelegramPhotoUrl()));
    };
    window.addEventListener("profilePhotoUpdated", updatePhoto);
    return () => window.removeEventListener("profilePhotoUpdated", updatePhoto);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    const amt = params.get("amount");
    const aiParam = params.get("ai");
    if (t) setToken(t.toUpperCase());
    if (amt) setPot(Number(amt));
    const aiCount = aiParam ? Math.max(1, Math.min(3, Number(aiParam))) : 0;
    if (aiParam) setAi(aiCount);
    setAiPositions(Array(aiCount).fill(0));
    setAiAvatars(
      Array.from({ length: aiCount }, () => AVATARS[Math.floor(Math.random() * AVATARS.length)])
    );
    const colors = shuffle(TOKEN_COLORS).slice(0, aiCount + 1).map(c => c.color);
    setPlayerColors(colors);

    const boardSize = ROWS * COLS;
    const snakeCount = 6 + Math.floor(Math.random() * 3);
    const ladderCount = 6 + Math.floor(Math.random() * 3);

    const snakesObj = {};
    const used = new Set();
    while (Object.keys(snakesObj).length < snakeCount) {
      const start = Math.floor(Math.random() * (boardSize - 10)) + 10;
      const maxDrop = Math.min(start - 1, 20);
      if (maxDrop <= 0) continue;
      const end = start - (Math.floor(Math.random() * maxDrop) + 1);
      if (used.has(start) || used.has(end) || snakesObj[start]) continue;
      snakesObj[start] = end;
      used.add(start);
      used.add(end);
    }

    const laddersObj = {};
    const usedL = new Set([...used]);
    while (Object.keys(laddersObj).length < ladderCount) {
      const start = Math.floor(Math.random() * (boardSize - 20)) + 2;
      const max = Math.min(boardSize - start - 1, 20);
      if (max < 1) continue;
      const end = start + (Math.floor(Math.random() * max) + 1);
      if (
        usedL.has(start) ||
        usedL.has(end) ||
        laddersObj[start] ||
        Object.values(laddersObj).includes(end)
      )
        continue;
      laddersObj[start] = end;
      usedL.add(start);
      usedL.add(end);
    }

    setSnakes(snakesObj);
    setLadders(laddersObj);

    const snk = {};
    Object.entries(snakesObj).forEach(([s, e]) => {
      snk[s] = s - e;
    });
    const lad = {};
    Object.entries(laddersObj).forEach(([s, e]) => {
      const end = typeof e === "object" ? e.end : e;
      lad[s] = end - s;
    });
    setSnakeOffsets(snk);
    setLadderOffsets(lad);

    const diceMap = {};
    const diceValues = [1, 2, 1];
    const usedD = new Set([...usedL]);
    diceValues.forEach((val) => {
      let cell;
      do {
        cell = Math.floor(Math.random() * boardSize) + 1;
      } while (usedD.has(cell) || cell === FINAL_TILE);
      diceMap[cell] = val;
      usedD.add(cell);
    });
    setDiceCells(diceMap);
  }, []);

  useEffect(() => {
    const key = `snakeGameState_${ai}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setPos(data.pos ?? 0);
        setAiPositions(data.aiPositions ?? Array(ai).fill(0));
        setCurrentTurn(data.currentTurn ?? 0);
        setDiceCells(data.diceCells ?? {});
        setSnakes(data.snakes ?? {});
        setLadders(data.ladders ?? {});
        setSnakeOffsets(data.snakeOffsets ?? {});
        setLadderOffsets(data.ladderOffsets ?? {});
        setRanking(data.ranking ?? []);
        setGameOver(data.gameOver ?? false);
      } catch {}
    }
  }, [ai]);

  useEffect(() => {
    const key = `snakeGameState_${ai}`;
    const data = {
      pos,
      aiPositions,
      currentTurn,
      diceCells,
      snakes,
      ladders,
      snakeOffsets,
      ladderOffsets,
      ranking,
      gameOver,
    };
    localStorage.setItem(key, JSON.stringify(data));
  }, [ai, pos, aiPositions, currentTurn, diceCells, snakes, ladders, snakeOffsets, ladderOffsets, ranking, gameOver]);

  const handleRoll = (values) => {
    setTurnMessage("");
    const value = Array.isArray(values)
      ? values.reduce((a, b) => a + b, 0)
      : values;

    setRollResult(value);
    setTimeout(() => setRollResult(null), 1500);

    setTimeout(() => {
      setDiceVisible(false);
      setOffsetPopup(null);
      setTrail([]);

      const rolledSix = Array.isArray(values)
        ? values.includes(6)
        : value === 6;

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
      let extraTurn = false;

      if (current === 100 && diceCount === 2) {
        if (rolledSix) {
          setDiceCount(1);
          setMessage("Six rolled! One die removed.");
        } else {
          setMessage("Need a 6 to remove a die.");
        }
        setTurnMessage("Your turn");
        setDiceVisible(true);
        return;
      } else if (current === 100 && diceCount === 1) {
        if (value === 1) {
          target = FINAL_TILE;
        } else {
          setMessage("Need a 1 to win!");
          setTurnMessage("Your turn");
          setDiceVisible(true);
          return;
        }
      } else if (current === 0) {
        if (rolledSix) target = 1;
        else {
          setMessage("Need a 6 to start!");
          setTurnMessage("");
          setDiceVisible(false);
          const next = (currentTurn + 1) % (ai + 1);
          setTimeout(() => setCurrentTurn(next), 1500);
          return;
        }
      } else if (current + value <= FINAL_TILE) {
        target = current + value;
      } else {
        setMessage("Need exact roll!");
        setTurnMessage("Your turn");
        setDiceVisible(true);
        return;
      }

      extraTurn = rolledSix && target !== current;

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
        const snakeEnd = snakes[startPos];
        const ladderObj = ladders[startPos];
        const ladderEnd =
          typeof ladderObj === "object" ? ladderObj.end : ladderObj;

        if (snakeEnd != null) {
          const offset = startPos - snakeEnd;
          setTrail([{ cell: startPos, type: "snake" }]);
          setOffsetPopup({ cell: startPos, type: "snake", amount: offset });
          setTimeout(() => setOffsetPopup(null), 1000);
          setMessage(`🐍 ${startPos} -${offset}`);
          setMessageColor("text-red-500");
          snakeSoundRef.current?.play().catch(() => {});
          const seq = [];
          for (let i = 1; i <= offset && startPos - i >= 0; i++)
            seq.push(startPos - i);
          const move = () =>
            moveSeq(seq, "snake", () =>
              finalizeMove(Math.max(0, snakeEnd), "snake"),
            );
          flashHighlight(startPos, "snake", 2, move);
        } else if (ladderEnd != null) {
          const offset = ladderEnd - startPos;
          setTrail((t) =>
            t.map((h) => (h.cell === startPos ? { ...h, type: "ladder" } : h)),
          );
          setOffsetPopup({ cell: startPos, type: "ladder", amount: offset });
          setTimeout(() => setOffsetPopup(null), 1000);
          setMessage(`🪜 ${startPos} +${offset}`);
          setMessageColor("text-green-500");
          ladderSoundRef.current?.play().catch(() => {});
          const seq = [];
          for (let i = 1; i <= offset && startPos + i <= FINAL_TILE; i++)
            seq.push(startPos + i);
          const move = () =>
            moveSeq(seq, "ladder", () =>
              finalizeMove(Math.min(FINAL_TILE, ladderEnd), "ladder"),
            );
          flashHighlight(startPos, "ladder", 2, move);
        } else {
          finalizeMove(startPos, "normal");
        }
      };

      const finalizeMove = (finalPos, type) => {
        setPos(finalPos);
        setHighlight({ cell: finalPos, type });
        setTrail([]);
        setTokenType(type);
        setTimeout(() => setHighlight(null), 300);
        capturePieces(finalPos, 0);
        if (finalPos === FINAL_TILE && !ranking.includes('You')) {
          if (ranking.length === 0) {
            const id = getTelegramId();
            deposit(id, pot).catch(() => {});
          }
          setRanking(r => {
            const next = [...r, 'You'];
            if (next.length === ai + 1) setGameOver(true);
            return next;
          });
          setMessage(`You win ${pot} ${token}!`);
          setMessageColor("");
          winSoundRef.current?.play().catch(() => {});
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
          setCelebrate(true);
          setTimeout(() => {
            setCelebrate(false);
            setDiceCount(2);
          }, 1500);
        }
        if (diceCells[finalPos]) {
          const bonus = diceCells[finalPos];
          setDiceCells((d) => {
            const n = { ...d };
            delete n[finalPos];
            return n;
          });
          setBonusDice(bonus);
          setTurnMessage(`Bonus roll +${bonus}`);
          diceRewardSoundRef.current?.play().catch(() => {});
        } else {
          setTurnMessage("Your turn");
          setBonusDice(0);
        }
        setDiceVisible(true);
        if (!gameOver) {
          const next = extraTurn ? currentTurn : (currentTurn + 1) % (ai + 1);
          setCurrentTurn(next);
        }
      };

      moveSeq(steps, "normal", () => applyEffect(target));
    }, 1500);
  };

  const triggerAIRoll = (index) => {
    setAiRollingIndex(index);
    setTurnMessage(<>{playerName(index)} rolling...</>);
    setAiRollTrigger((t) => t + 1);
    setDiceVisible(true);
  };

  const handleAIRoll = (index, fixedValue) => {
    const value = fixedValue ?? Math.floor(Math.random() * 6) + 1;
    setTurnMessage(<>{playerName(index)} rolled {value}</>);
    setRollResult(value);
    setTimeout(() => setRollResult(null), 1500);
    setTimeout(() => {
      setDiceVisible(false);
    let positions = [...aiPositions];
    let current = positions[index - 1];
    let target = current;
    if (current === 0) {
      if (value === 6) target = 1;
    } else if (current === 100) {
      if (value === 1) target = FINAL_TILE;
    } else if (current + value <= FINAL_TILE) {
      target = current + value;
    }

    const rolledSix = value === 6;
    const extraTurn = rolledSix && target !== current;

    const steps = [];
    for (let i = current + 1; i <= target; i++) steps.push(i);

    const moveSeq = (seq, type, done) => {
      const stepMove = (idx) => {
        if (idx >= seq.length) return done();
        const next = seq[idx];
        positions[index - 1] = next;
        setAiPositions([...positions]);
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

    const finalizeMove = (finalPos, type) => {
      positions[index - 1] = finalPos;
      setAiPositions([...positions]);
      setHighlight({ cell: finalPos, type });
      setTrail([]);
      capturePieces(finalPos, index);
      setTimeout(() => setHighlight(null), 300);
      if (finalPos === FINAL_TILE && !ranking.includes(`AI ${index}`)) {
        setRanking(r => {
          const next = [...r, `AI ${index}`];
          if (next.length === ai + 1) setGameOver(true);
          return next;
        });
        setMessage(`AI ${index} wins!`);
        setDiceVisible(false);
        return;
      }
      const next = extraTurn ? index : (index + 1) % (ai + 1);
      if (next === 0) setTurnMessage('Your turn');
      setCurrentTurn(next);
      setDiceVisible(true);
    };

    const applyEffect = (startPos) => {
      const snakeEnd = snakes[startPos];
      const ladderObj = ladders[startPos];
      const ladderEnd = typeof ladderObj === 'object' ? ladderObj.end : ladderObj;

      if (snakeEnd != null) {
        const offset = startPos - snakeEnd;
        setTrail([{ cell: startPos, type: 'snake' }]);
        setOffsetPopup({ cell: startPos, type: 'snake', amount: offset });
        setTimeout(() => setOffsetPopup(null), 1000);
        snakeSoundRef.current?.play().catch(() => {});
        const seq = [];
        for (let i = 1; i <= offset && startPos - i >= 0; i++) seq.push(startPos - i);
        const move = () => moveSeq(seq, 'snake', () => finalizeMove(Math.max(0, snakeEnd), 'snake'));
        flashHighlight(startPos, 'snake', 2, move);
      } else if (ladderEnd != null) {
        const offset = ladderEnd - startPos;
        setTrail((t) => t.map((h) => (h.cell === startPos ? { ...h, type: 'ladder' } : h)));
        setOffsetPopup({ cell: startPos, type: 'ladder', amount: offset });
        setTimeout(() => setOffsetPopup(null), 1000);
        ladderSoundRef.current?.play().catch(() => {});
        const seq = [];
        for (let i = 1; i <= offset && startPos + i <= FINAL_TILE; i++) seq.push(startPos + i);
        const move = () => moveSeq(seq, 'ladder', () => finalizeMove(Math.min(FINAL_TILE, ladderEnd), 'ladder'));
        flashHighlight(startPos, 'ladder', 2, move);
      } else {
        finalizeMove(startPos, 'normal');
      }
    };

    moveSeq(steps, 'normal', () => applyEffect(target));
    }, 1500);
  };

  useEffect(() => {
    if (!setupPhase || aiPositions.length !== ai) return;
    const total = ai + 1;
    if (total === 1) {
      setSetupPhase(false);
      setTurnMessage('Your turn');
      setCurrentTurn(0);
      return;
    }
    const indices = Array.from({ length: total }, (_, i) => i);
    const start = Math.floor(Math.random() * total);
    const rollOrder = [];
    for (let i = 0; i < total; i++) rollOrder.push(indices[(start + i) % total]);
    setDiceVisible(false);
    const results = [];
    const rollNext = (idx) => {
      if (idx >= rollOrder.length) {
        const sorted = [...results].sort((a, b) => b.roll - a.roll);
        setInitialRolls(results);
        setTurnOrder(sorted.map((r) => r.index));
        setTurnMessage(
          <>
            Order: {sorted.map((r, i) => (
              <span key={r.index} style={{ color: playerColors[r.index] }}>
                {i > 0 && ', '} {r.index === 0 ? 'You' : `AI ${r.index}`}
                ({r.roll})
              </span>
            ))}
          </>
        );
        const first = sorted[0];
        setTimeout(() => {
          setSetupPhase(false);
          setDiceVisible(true);
          setCurrentTurn(first.index);
          if (first.index === 0) handleRoll(first.roll);
          else handleAIRoll(first.index, first.roll);
        }, 1000);
        return;
      }
      const idxPlayer = rollOrder[idx];
      const roll = Math.floor(Math.random() * 6) + 1;
      results.push({ index: idxPlayer, roll });
      setTurnMessage(<>{playerName(idxPlayer)} rolled {roll}</>);
      setTimeout(() => rollNext(idx + 1), 1000);
    };
    rollNext(0);
  }, [ai, aiPositions, setupPhase]);


  useEffect(() => {
    if (!setupPhase && currentTurn === 0 && !gameOver) {
      setTurnMessage('Your turn');
    }
  }, [currentTurn, setupPhase, gameOver]);

  useEffect(() => {
    if (setupPhase || gameOver) return;
    const limit = currentTurn === 0 ? 15 : 3;
    const beep = currentTurn === 0 ? 7 : 2;
    setTimeLeft(limit);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        const next = t - 1;
        if (next <= beep && next >= 0) timerSoundRef.current?.play().catch(() => {});
        if (next <= 0) {
          clearInterval(timerRef.current);
          if (currentTurn === 0) {
            setPlayerAutoRolling(true);
            setTurnMessage('Rolling...');
            setPlayerRollTrigger((r) => r + 1);
          } else {
            triggerAIRoll(currentTurn);
          }
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [currentTurn, setupPhase, gameOver]);

  const players = [
    { position: pos, photoUrl, type: tokenType, color: playerColors[0] },
    ...aiPositions.map((p, i) => ({ position: p, photoUrl: aiAvatars[i] || '/assets/icons/profile.svg', type: 'normal', color: playerColors[i + 1] }))
  ];

  // determine ranking numbers based on board positions
  const rankMap = {};
  players
    .map((p, i) => ({ idx: i, pos: p.position }))
    .sort((a, b) => b.pos - a.pos)
    .forEach((p, i) => {
      rankMap[p.idx] = p.pos === 0 ? 0 : i + 1;
    });

  const handleReload = () => {
    localStorage.removeItem(`snakeGameState_${ai}`);
    window.location.reload();
  };

  return (
    <div className="p-4 pb-32 space-y-4 text-text flex flex-col justify-end items-center relative w-full flex-grow">
      {/* Action menu fixed to the top right */}
      <div className="fixed right-2 top-4 flex flex-col items-end space-y-2 z-20">
        <button
          onClick={handleReload}
          className="p-2 flex flex-col items-center"
        >
          <AiOutlineReload className="text-xl" />
          <span className="text-xs">Reload</span>
        </button>
        <button
          onClick={() => setShowInfo(true)}
          className="p-2 flex flex-col items-center"
        >
          <AiOutlineInfoCircle className="text-2xl" />
          <span className="text-xs">Info</span>
        </button>
        <button
          onClick={() => setShowExitConfirm(true)}
          className="p-2 flex flex-col items-center"
        >
          <AiOutlineLogout className="text-xl" />
          <span className="text-xs">Exit</span>
        </button>
        <button
          onClick={() => setShowLobbyConfirm(true)}
          className="p-2 flex flex-col items-center"
        >
          <AiOutlineRollback className="text-xl" />
          <span className="text-xs">Lobby</span>
        </button>
      </div>
      {/* Player photos stacked vertically */}
      <div className="fixed left-2 top-4 flex flex-col space-y-2 z-20">
        {players
          .map((p, i) => ({ ...p, index: i }))
          .map((p) => (
            <AvatarTimer
              key={`player-${p.index}`}
              photoUrl={p.photoUrl}
              active={p.index === currentTurn}
              rank={rankMap[p.index]}
              name={p.index === 0 ? 'You' : `AI ${p.index}`}
              timerPct={
                p.index === currentTurn
                  ? timeLeft / (p.index === 0 ? 15 : 3)
                  : 1
              }
            />
          ))}
      </div>
      <Board
        players={players}
        highlight={highlight}
        trail={trail}
        pot={pot}
        snakes={snakes}
        ladders={ladders}
        snakeOffsets={snakeOffsets}
        ladderOffsets={ladderOffsets}
        offsetPopup={offsetPopup}
        celebrate={celebrate}
        token={token}
        tokenType={tokenType}
        diceCells={diceCells}
        rollingIndex={rollingIndex}
        currentTurn={currentTurn}
        timerPct={timeLeft / (currentTurn === 0 ? 15 : 3)}
        burning={burning}
      />
      {rollResult !== null && (
        <div className="fixed bottom-44 inset-x-0 flex justify-center z-30 pointer-events-none">
          <div className="text-6xl roll-result">{rollResult}</div>
        </div>
      )}
      {diceVisible && (
        <div className="fixed bottom-24 inset-x-0 flex flex-col items-center z-20">
          <DiceRoller
            onRollEnd={(vals) => {
              const total = Array.isArray(vals) ? vals.reduce((a, b) => a + b, 0) : vals;
              if (aiRollingIndex) {
                handleAIRoll(aiRollingIndex, total);
                setAiRollingIndex(null);
              } else {
                handleRoll(vals);
                setBonusDice(0);
              }
              setRollingIndex(null);
              setPlayerAutoRolling(false);
            }}
            onRollStart={() =>
              {
                setRollingIndex(aiRollingIndex || 0);
                if (aiRollingIndex)
                  return setTurnMessage(<>{playerName(aiRollingIndex)} rolling...</>);
                if (playerAutoRolling) return setTurnMessage('Rolling...');
                return setTurnMessage("Rolling...");
              }
            }
            clickable={!aiRollingIndex && !playerAutoRolling}
            numDice={diceCount + bonusDice}
            trigger={aiRollingIndex != null ? aiRollTrigger : playerAutoRolling ? playerRollTrigger : undefined}
            showButton={!aiRollingIndex && !playerAutoRolling}
          />
          {turnMessage && (
            <div
              className="mt-2 turn-message"
              style={
                turnMessage === 'Your turn' ? { color: playerColors[0] } : {}
              }
            >
              {turnMessage}
            </div>
          )}
          {message === 'Need a 6 to start!' && (
            <div className={`mt-1 turn-message ${messageColor}`}>{message}</div>
          )}
        </div>
      )}
      {message && message !== 'Need a 6 to start!' && (
        <div className={`text-center font-semibold w-full ${messageColor}`}>{message}</div>
      )}
      <InfoPopup
        open={showInfo}
        onClose={() => setShowInfo(false)}
        title="Snake & Ladder"
        info="Roll the dice to move across the board. Ladders move you up, snakes bring you down. The Pot at the top collects everyone's stake – reach it first to claim the total amount."
      />
      <GameEndPopup
        open={gameOver}
        ranking={ranking}
        onPlayAgain={() => {
          localStorage.removeItem(`snakeGameState_${ai}`);
          window.location.reload();
        }}
        onReturn={() => {
          localStorage.removeItem(`snakeGameState_${ai}`);
          navigate("/games/snake/lobby");
        }}
      />
      <ConfirmPopup
        open={showExitConfirm}
        message="Are you sure you want to quit?"
        onConfirm={() => {
          localStorage.removeItem(`snakeGameState_${ai}`);
          navigate("/games");
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
      <ConfirmPopup
        open={showLobbyConfirm}
        message="Return to lobby and end the game?"
        onConfirm={() => {
          localStorage.removeItem(`snakeGameState_${ai}`);
          navigate("/games/snake/lobby");
        }}
        onCancel={() => setShowLobbyConfirm(false)}
      />
    </div>
  );
}
