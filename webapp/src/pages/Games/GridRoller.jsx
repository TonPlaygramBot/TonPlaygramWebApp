import { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import DiceRoller from "../../components/DiceRoller.jsx";
import PlayerToken from "../../components/PlayerToken.jsx";
import InfoPopup from "../../components/InfoPopup.jsx";
import GameEndPopup from "../../components/GameEndPopup.jsx";
import { AiOutlineInfoCircle, AiOutlineLogout } from "react-icons/ai";
import useTelegramBackButton from "../../hooks/useTelegramBackButton.js";
import { useNavigate } from "react-router-dom";
import { getTelegramId, getTelegramPhotoUrl } from "../../utils/telegram.js";
import { fetchTelegramInfo, getProfile } from "../../utils/api.js";

const ROWS = 20;
const COLS = 5;
const FINAL_TILE = ROWS * COLS + 1; // 101

function Board({ position, highlight, photoUrl, pot, celebrate, token, tokenType }) {
  const containerRef = useRef(null);
  const [cellWidth, setCellWidth] = useState(80);
  const [cellHeight, setCellHeight] = useState(40);
  const tiles = [];
  const centerCol = (COLS - 1) / 2;
  const widenStep = 0.05;
  const scaleStep = 0.02;
  const finalScale = 1 + (ROWS - 3) * scaleStep;
  const rowOffsets = [0];
  for (let r = 1; r < ROWS; r++) {
    const prevScale = 1 + (r - 3) * scaleStep;
    rowOffsets[r] = rowOffsets[r - 1] + (prevScale - 1) * cellHeight;
  }
  const offsetYMax = rowOffsets[ROWS - 1];

  for (let r = 0; r < ROWS; r++) {
    const rowFactor = r - 2;
    const scale = 1 + rowFactor * scaleStep;
    const rowPos = r / (ROWS - 1);
    const scaleX = scale * (1 + rowPos * widenStep);
    const offsetX = (scaleX - 1) * cellWidth;
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
      const highlightClass = isHighlight ? `normal-highlight` : "";
      const style = {
        gridRowStart: ROWS - r,
        gridColumnStart: col + 1,
        transform: `translate(${translateX}px, ${translateY}px) scaleX(${scaleX}) scaleY(${scale}) translateZ(5px)`,
        transformOrigin: "bottom center",
      };
      if (!highlightClass) style.backgroundColor = rowColor;

      tiles.push(
        <div key={num} data-cell={num} className={`board-cell ${highlightClass}`} style={style}>
          <span className="cell-number">{num}</span>
          {num === 1 && (
            <span className="cell-marker start-rotate">
              <span className="cell-icon">⬢</span>
            </span>
          )}
          {position === num && (
            <PlayerToken photoUrl={photoUrl} type={highlight ? highlight.type : tokenType} className="" />
          )}
        </div>
      );
    }
  }

  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      const cw = Math.floor(width / COLS);
      setCellWidth(cw);
      const ch = Math.floor(cw / 1.7);
      setCellHeight(ch);
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const angle = 70;
  const boardXOffset = -10;
  const boardYOffset = -40;

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      const target = container.scrollHeight - container.clientHeight;
      container.scrollTop = Math.max(0, target);
    }
  }, [cellHeight]);

  return (
    <div className="flex justify-center items-center w-screen overflow-hidden">
      <div
        ref={containerRef}
        className="overflow-y-auto"
        style={{
          overflowX: "hidden",
          height: "100vh",
          overscrollBehaviorY: "contain",
          paddingTop: 0,
          paddingBottom: "15vh",
        }}
      >
        <div className="snake-board-tilt">
          <div
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
              transform: `translate(${boardXOffset}px, ${boardYOffset}px) rotateX(${angle}deg) scale(0.9455)`,
            }}
          >
            <div className="snake-gradient-bg" />
            {tiles}
            <div className={`pot-cell ${highlight && highlight.cell === FINAL_TILE ? "highlight" : ""}`}>
              <PlayerToken color="#16a34a" topColor="#ff0000" className="pot-token" />
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
          style={{ "--dx": `${c.dx}px`, "--delay": `${c.delay}s`, "--dur": `${c.dur}s` }}
        />
      ))}
    </div>
  );
}

export default function GridRoller() {
  useTelegramBackButton();
  const navigate = useNavigate();
  const [pos, setPos] = useState(0);
  const [streak, setStreak] = useState(0);
  const [highlight, setHighlight] = useState(null); // { cell: number, type: string }
  const [tokenType, setTokenType] = useState("normal");
  const [message, setMessage] = useState("");
  const [turnMessage, setTurnMessage] = useState("Your turn");
  const [diceVisible, setDiceVisible] = useState(true);
  const [photoUrl, setPhotoUrl] = useState("");
  const [pot, setPot] = useState(101);
  const [token, setToken] = useState("TPC");
  const [celebrate, setCelebrate] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [rollResult, setRollResult] = useState(null);
  const [diceCount, setDiceCount] = useState(2);
  const [gameOver, setGameOver] = useState(false);
  const moveSoundRef = useRef(null);
  const winSoundRef = useRef(null);

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
    moveSoundRef.current = new Audio("/assets/sounds/drop.mp3");
    winSoundRef.current = new Audio("/assets/sounds/successful.mp3");
    return () => {
      moveSoundRef.current?.pause();
      winSoundRef.current?.pause();
    };
  }, []);

  const handleRoll = (values) => {
    setTurnMessage("");
    const value = Array.isArray(values) ? values.reduce((a, b) => a + b, 0) : values;
    setRollResult(value);
    setTimeout(() => setRollResult(null), 1500);

    setTimeout(() => {
      setDiceVisible(false);
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
        return;
      }

      const steps = [];
      for (let i = current + 1; i <= target; i++) steps.push(i);

      const moveSeq = (seq, done) => {
        const stepMove = (idx) => {
          if (idx >= seq.length) return done();
          const next = seq[idx];
          setPos(next);
          moveSoundRef.current.currentTime = 0;
          moveSoundRef.current.play().catch(() => {});
          setHighlight({ cell: next, type: "normal" });
          setTimeout(() => stepMove(idx + 1), 700);
        };
        stepMove(0);
      };

      const finalizeMove = (finalPos) => {
        setPos(finalPos);
        setHighlight({ cell: finalPos, type: "normal" });
        setTimeout(() => setHighlight(null), 300);
        if (finalPos === FINAL_TILE) {
          setMessage(`You win ${pot} ${token}!`);
          winSoundRef.current?.play().catch(() => {});
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
          setCelebrate(true);
          setTimeout(() => {
            setCelebrate(false);
            setDiceCount(2);
            setGameOver(true);
          }, 1500);
        }
        setTurnMessage("Your turn");
        setDiceVisible(true);
      };

      moveSeq(steps, () => finalizeMove(target));
    }, 1500);
  };

  return (
    <div className="p-4 pb-32 space-y-4 text-text flex flex-col justify-end items-center relative w-full flex-grow">
      <div className="absolute top-0 -right-2 flex flex-col items-end space-y-2 p-2 z-20">
        <button onClick={() => setShowInfo(true)} className="p-2 flex flex-col items-center">
          <AiOutlineInfoCircle className="text-2xl" />
          <span className="text-xs">Info</span>
        </button>
        <button onClick={() => navigate("/games")} className="p-2 flex flex-col items-center">
          <AiOutlineLogout className="text-xl" />
          <span className="text-xs">Exit</span>
        </button>
      </div>
      <Board
        position={pos}
        highlight={highlight}
        photoUrl={photoUrl}
        pot={pot}
        celebrate={celebrate}
        token={token}
        tokenType={tokenType}
      />
      {rollResult !== null && (
        <div className="fixed bottom-44 inset-x-0 flex justify-center z-30 pointer-events-none">
          <div className="text-6xl roll-result">{rollResult}</div>
        </div>
      )}
      {diceVisible && (
        <div className="fixed bottom-24 inset-x-0 flex flex-col items-center z-20">
          <DiceRoller
            onRollEnd={(vals) => handleRoll(vals)}
            onRollStart={() => setTurnMessage("Rolling...")}
            clickable
            numDice={diceCount}
          />
          {turnMessage && <div className="mt-2 turn-message">{turnMessage}</div>}
          {message === 'Need a 6 to start!' && (
            <div className="mt-1 turn-message text-red-500">{message}</div>
          )}
        </div>
      )}
      {message && message !== 'Need a 6 to start!' && (
        <div className="text-center font-semibold w-full">{message}</div>
      )}
      <InfoPopup
        open={showInfo}
        onClose={() => setShowInfo(false)}
        title="Grid Roller"
        info="Roll the dice to move across the board. Reach the Pot at the top to claim the total amount."
      />
      <GameEndPopup
        open={gameOver}
        ranking={["You"]}
        onPlayAgain={() => window.location.reload()}
        onReturn={() => navigate("/games")}
      />
    </div>
  );
}
