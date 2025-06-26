import { useState, useEffect, useRef, useLayoutEffect, Fragment } from "react";
import confetti from "canvas-confetti";
import DiceRoller from "../../components/DiceRoller.jsx";
import { dropSound, snakeSound, ladderSound, bombSound, timerBeep } from "../../assets/soundData.js";
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
import { fetchTelegramInfo, getProfile, deposit, getSnakeBoard } from "../../utils/api.js";
import PlayerToken from "../../components/PlayerToken.jsx";
import AvatarTimer from "../../components/AvatarTimer.jsx";
import ConfirmPopup from "../../components/ConfirmPopup.jsx";

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
  burning = [],
}) {
  const containerRef = useRef(null);
  const gridRef = useRef(null);
  const tile1Ref = useRef(null);
  const [cellWidth, setCellWidth] = useState(80);
  const [cellHeight, setCellHeight] = useState(40);
  // const tileRect removed - no longer highlighting the first cell
  const tiles = [];
  const centerCol = (COLS - 1) / 2;
  // Gradual horizontal widening towards the top. Keep the bottom
  // row the same width and slightly expand each successive row so
  // the board forms a soft V shape.
  // Increase the widening and scaling so the top merges with the logo
  const widenStep = 0.07; // how much each row expands horizontally
  const scaleStep = 0.03; // how much each row's cells scale
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
      const iconImage =
        cellType === "ladder"
          ? "/assets/icons/ladder.svg"
          : cellType === "snake"
            ? "/assets/icons/snake.svg"
            : null;
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
          {(iconImage || offsetVal != null) && (
            <span className="cell-marker">
              {iconImage && (
                <img src={iconImage} className="cell-icon" />
              )}
            </span>
          )}
          {!cellType && <span className="cell-number">{num}</span>}
          {diceCells && diceCells[num] && (
            <span className="dice-marker">
              <img src="/assets/icons/Dice.png" className="dice-icon" />
            </span>
          )}
          {players
            .map((p, i) => ({ ...p, index: i }))
            .filter((p) => p.position !== 0 && p.position === num)
            .map((p) => (
              <Fragment key={p.index}>
                <div
                  className="start-hexagon"
                  style={{
                    '--hex-color': p.color,
                    '--hex-border-color': p.color,
                    '--hex-spin-duration': '7s',
                  }}
                />
                <PlayerToken
                  photoUrl={p.photoUrl}
                  type={p.type || (p.index === 0 ? (isHighlight ? highlight.type : tokenType) : "normal")}
                  color={p.color}
                  rolling={p.index === rollingIndex}
                  active={p.index === currentTurn}
                  className={
                    (p.position === 0
                      ? "start"
                      : p.index === 0 && isJump
                        ? "jump"
                        : "") +
                    (burning.includes(p.index) ? " burning" : "")
                  }
                />
              </Fragment>
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
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useLayoutEffect(() => {
    // board layout recalculations
  }, [cellWidth, cellHeight]);



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
  // Move the board slightly downward so the top row clears the logo frame
  const boardYOffset = 60; // pixels - slightly lower
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
      <img src="/assets/SnakeLaddersbackground.png" className="background-behind-board object-cover" alt="" />
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
            {/* Game background is rendered outside the grid */}
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
                  <Fragment key={`win-${p.index}`}>
                    <div
                      className="start-hexagon"
                      style={{
                        '--hex-color': p.color,
                        '--hex-border-color': p.color,
                        '--hex-spin-duration': '7s',
                      }}
                    />
                    <PlayerToken
                      photoUrl={p.photoUrl}
                      type={p.type || 'normal'}
                      color={p.color}
                    />
                  </Fragment>
                ))}
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
  const [highlight, setHighlight] = useState(null); // { cell: number, type: string }
  const [trail, setTrail] = useState([]);
  const [tokenType, setTokenType] = useState("normal");
  const [message, setMessage] = useState("");
  const [messageColor, setMessageColor] = useState("");
  const [turnMessage, setTurnMessage] = useState("Your turn");
  const [diceVisible, setDiceVisible] = useState(true);
  const [photoUrl, setPhotoUrl] = useState(getTelegramPhotoUrl());
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
  const [refreshTick, setRefreshTick] = useState(0);
  const [rollCooldown, setRollCooldown] = useState(0);

  // Preload token and avatar images so board icons and AI photos display
  // immediately without waiting for network requests during gameplay.
  useEffect(() => {
    ['ton', 'tpc', 'usdt'].forEach((t) => {
      const img = new Image();
      img.src = `/icons/${t}.svg`;
    });
    AVATARS.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    if (rollCooldown <= 0) return;
    const id = setInterval(() => {
      setRollCooldown((c) => {
        if (c <= 1) {
          clearInterval(id);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [rollCooldown]);

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
  const aiRollTimeoutRef = useRef(null);

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

    const table = params.get("table") || "snake-4";
    getSnakeBoard(table)
      .then(({ snakes: snakesObj = {}, ladders: laddersObj = {} }) => {
        const limit = (obj) => {
          return Object.fromEntries(Object.entries(obj).slice(0, 8));
        };
        const snakesLim = limit(snakesObj);
        const laddersLim = limit(laddersObj);
        setSnakes(snakesLim);
        setLadders(laddersLim);
        const snk = {};
        Object.entries(snakesLim).forEach(([s, e]) => {
          snk[s] = s - e;
        });
        const lad = {};
        Object.entries(laddersLim).forEach(([s, e]) => {
          const end = typeof e === "object" ? e.end : e;
          lad[s] = end - s;
        });
        setSnakeOffsets(snk);
        setLadderOffsets(lad);

        const boardSize = ROWS * COLS;
        const diceMap = {};
        const diceValues = [1, 2, 1];
        const usedD = new Set([
          ...Object.keys(snakesLim),
          ...Object.keys(laddersLim),
          ...Object.values(snakesLim),
          ...Object.values(laddersLim),
        ]);
        diceValues.forEach((val) => {
          let cell;
          do {
            cell = Math.floor(Math.random() * boardSize) + 1;
          } while (usedD.has(String(cell)) || usedD.has(cell) || cell === FINAL_TILE);
          diceMap[cell] = val;
          usedD.add(cell);
        });
        setDiceCells(diceMap);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const key = `snakeGameState_${ai}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const limit = (obj) =>
          Object.fromEntries(Object.entries(obj).slice(0, 8));
        const data = JSON.parse(stored);
        setPos(data.pos ?? 0);
        setAiPositions(data.aiPositions ?? Array(ai).fill(0));
        setCurrentTurn(data.currentTurn ?? 0);
        setDiceCells(data.diceCells ?? {});
        setSnakes(limit(data.snakes ?? {}));
        setLadders(limit(data.ladders ?? {}));
        setSnakeOffsets(limit(data.snakeOffsets ?? {}));
        setLadderOffsets(limit(data.ladderOffsets ?? {}));
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
    setRollCooldown(1);
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
      let current = pos;
      let target = current;

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
          setMessage('🐍');
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
          setMessage('🪜');
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
          const first = ranking.length === 0;
          if (first) {
            const id = getTelegramId();
            deposit(id, pot).catch(() => {});
          }
          setRanking(r => [...r, 'You']);
          if (first) setGameOver(true);
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
          setTurnMessage('Bonus roll');
          diceRewardSoundRef.current?.play().catch(() => {});
        } else {
          setTurnMessage("Your turn");
          setBonusDice(0);
        }
        setDiceVisible(true);
        if (!gameOver) {
          const next = (currentTurn + 1) % (ai + 1);
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
        const first = ranking.length === 0;
        setRanking(r => [...r, `AI ${index}`]);
        if (first) setGameOver(true);
        setMessage(`AI ${index} wins!`);
        setDiceVisible(false);
        return;
      }
      const next = (index + 1) % (ai + 1);
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
        const first = sorted[0];
        setTurnMessage(
          <>
            Order:{' '}
            {sorted.map((r, i) => (
              <span key={r.index} style={{ color: playerColors[r.index] }}>
                {i > 0 && ', '} {r.index === 0 ? 'You' : `AI ${r.index}`}({r.roll})
              </span>
            ))}
            . {first.index === 0 ? 'You' : `AI ${first.index}`} start first.
          </>
        );
        setTimeout(() => {
          setSetupPhase(false);
          setDiceVisible(true);
          setCurrentTurn(first.index);
        }, 1500);
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

  // Failsafe: ensure AI roll proceeds even if dice animation doesn't start
  useEffect(() => {
    if (aiRollingIndex != null) {
      if (aiRollTimeoutRef.current) clearTimeout(aiRollTimeoutRef.current);
      aiRollTimeoutRef.current = setTimeout(() => {
        setAiRollTrigger((t) => t + 1);
      }, 3000);
      return () => clearTimeout(aiRollTimeoutRef.current);
    }
  }, [aiRollingIndex]);

  useEffect(() => {
    if (setupPhase || gameOver) return;
    const limit = currentTurn === 0 ? 15 : 3;
    setTimeLeft(limit);
    if (timerRef.current) clearInterval(timerRef.current);
    if (timerSoundRef.current) timerSoundRef.current.pause();
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        const next = t - 1;
        if (next <= 7 && next >= 0 && timerSoundRef.current) {
          timerSoundRef.current.currentTime = 0;
          timerSoundRef.current.play().catch(() => {});
        }
        if (next <= 0) {
          timerSoundRef.current?.pause();
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
    return () => {
      clearInterval(timerRef.current);
      timerSoundRef.current?.pause();
    };
  }, [currentTurn, setupPhase, gameOver]);

  // Periodically refresh the component state to avoid freezes
  useEffect(() => {
    const id = setInterval(() => {
      setRefreshTick((t) => t + 1);
    }, 5000);
    return () => clearInterval(id);
  }, []);

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
      <div className="fixed right-1 top-4 flex flex-col items-center space-y-2 z-20">
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
                if (timerRef.current) clearInterval(timerRef.current);
                timerSoundRef.current?.pause();
                setRollingIndex(aiRollingIndex || 0);
                if (aiRollingIndex)
                  return setTurnMessage(<>{playerName(aiRollingIndex)} rolling...</>);
                if (playerAutoRolling) return setTurnMessage('Rolling...');
                return setTurnMessage("Rolling...");
              }
            }
            clickable={!aiRollingIndex && !playerAutoRolling && rollCooldown === 0}
            numDice={diceCount + bonusDice}
            trigger={aiRollingIndex != null ? aiRollTrigger : playerAutoRolling ? playerRollTrigger : undefined}
            showButton={!aiRollingIndex && !playerAutoRolling}
          />
          {rollCooldown > 0 && (
            <div className="text-sm mt-1">{rollCooldown}</div>
          )}
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
