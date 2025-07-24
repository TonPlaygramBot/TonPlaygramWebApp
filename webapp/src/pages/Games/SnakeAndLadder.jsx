import {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  Fragment,
} from "react";
import coinConfetti from "../../utils/coinConfetti";
import DiceRoller from "../../components/DiceRoller.jsx";
import {
  dropSound,
  snakeSound,
  ladderSound,
  bombSound,
  timerBeep,
  badLuckSound,
  cheerSound,
  chatBeep,
} from "../../assets/soundData.js";
import { AVATARS } from "../../components/AvatarPickerModal.jsx";
import { LEADER_AVATARS } from "../../utils/leaderAvatars.js";
import { FLAG_EMOJIS } from "../../utils/flagEmojis.js";
import generateBoard from "../../utils/generateBoard.js";
import { getAvatarUrl, saveAvatar, loadAvatar, avatarToName } from "../../utils/avatarUtils.js";
import InfoPopup from "../../components/InfoPopup.jsx";
import HintPopup from "../../components/HintPopup.jsx";
import GameEndPopup from "../../components/GameEndPopup.jsx";
import {
  AiOutlineRollback,
  AiOutlineReload,
} from "react-icons/ai";
import BottomLeftIcons from "../../components/BottomLeftIcons.jsx";
import { isGameMuted, getGameVolume } from "../../utils/sound.js";
import useTelegramBackButton from "../../hooks/useTelegramBackButton.js";
import { useNavigate } from "react-router-dom";
import { getPlayerId, getTelegramId, ensureAccountId } from "../../utils/telegram.js";
import {
  getProfileByAccount,
  depositAccount,
  getSnakeBoard,
  pingOnline,
  addTransaction,
  unseatTable
} from "../../utils/api.js";
// Developer accounts that receive shares of each pot
const DEV_ACCOUNT = import.meta.env.VITE_DEV_ACCOUNT_ID;
const DEV_ACCOUNT_1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
const DEV_ACCOUNT_2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;

async function awardDevShare(total) {
  const promises = [];
  if (DEV_ACCOUNT_1 || DEV_ACCOUNT_2) {
    if (DEV_ACCOUNT) {
      promises.push(
        depositAccount(DEV_ACCOUNT, Math.round(total * 0.09), {
          game: 'snake-dev',
        })
      );
    }
    if (DEV_ACCOUNT_1) {
      promises.push(
        depositAccount(DEV_ACCOUNT_1, Math.round(total * 0.01), {
          game: 'snake-dev1',
        })
      );
    }
    if (DEV_ACCOUNT_2) {
      promises.push(
        depositAccount(DEV_ACCOUNT_2, Math.round(total * 0.02), {
          game: 'snake-dev2',
        })
      );
    }
  } else if (DEV_ACCOUNT) {
    promises.push(
      depositAccount(DEV_ACCOUNT, Math.round(total * 0.1), {
        game: 'snake-dev',
      })
    );
  }
  if (promises.length) {
    try {
      await Promise.all(promises);
    } catch {
      // ignore errors when depositing developer shares
    }
  }
}
import { socket } from "../../utils/socket.js";
import PlayerToken from "../../components/PlayerToken.jsx";
import AvatarTimer from "../../components/AvatarTimer.jsx";
import ConfirmPopup from "../../components/ConfirmPopup.jsx";
import PlayerPopup from "../../components/PlayerPopup.jsx";
import QuickMessagePopup from "../../components/QuickMessagePopup.jsx";
import GiftPopup from "../../components/GiftPopup.jsx";
import { giftSounds } from "../../utils/giftSounds.js";
import { moveSeq, flashHighlight, applyEffect as applyEffectHelper } from "../../utils/moveHelpers.js";

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
const TURN_TIME = 15;

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
          src={
            token.toUpperCase() === 'TPC'
              ? '/assets/icons/TPCcoin_1.webp'
              : token.toUpperCase() === 'TON'
              ? '/assets/icons/TON.webp'
              : '/assets/icons/Usdt.webp'
          }
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
    const rowColor = "#6db0ad";

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
          ? "/assets/icons/Ladder.webp"
          : cellType === "snake"
            ? "/assets/icons/snake_vector_no_bg.webp"
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
              {iconImage && <img src={iconImage} className="cell-icon" />}
              {offsetVal != null && (
                <span
                  className={`offset-text ${
                    cellType === 'snake'
                      ? 'snake-text'
                      : 'ladder-text'
                  }`}
                >
                  {cellType === 'snake'
                    ? `-${offsetVal}`
                    : `+${offsetVal}`}
                </span>
              )}
            </span>
          )}
          {!cellType && <span className="cell-number">{num}</span>}
          {diceCells && diceCells[num] && (
            <span className="dice-marker">
              <img  src="/assets/icons/file_000000009160620a96f728f463de1c3f.webp" className="dice-icon" />
              <span className="dice-value">+{diceCells[num]}</span>
            </span>
          )}
          {players
            .map((p, i) => ({ ...p, index: i }))
            .filter((p) => p.position !== 0 && p.position === num)
            .map((p) => (
              <Fragment key={p.index}>
                <PlayerToken
                  photoUrl={p.photoUrl}
                  type={p.type || (p.index === 0 ? (isHighlight ? highlight.type : tokenType) : "normal")}
                  color={p.color}
                  rolling={p.index === rollingIndex}
                  active={p.index === currentTurn}
                  photoOnly
                  className={
                    "board-token " +
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
  // Slightly shift the board to the right so it is not perfectly centred
  const boardXOffset = 20; // pixels - nudge board slightly right
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
      <div
        ref={containerRef}
        className="overflow-y-auto"
        style={{
          overflowX: "hidden",
          height: "100vh",
          overscrollBehaviorY: "none",
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
              <div className="pot-icon">
                <img
                  src={
                    token === 'TON'
                      ? '/assets/icons/TON.webp'
                      : token === 'USDT'
                        ? '/assets/icons/Usdt.webp'
                        : '/assets/icons/TPCcoin_1.webp'
                  }
                  alt={token}
                  className="coin-face front"
                />
                <img
                  src={
                    token === 'TON'
                      ? '/assets/icons/TON.webp'
                      : token === 'USDT'
                        ? '/assets/icons/Usdt.webp'
                        : '/assets/icons/TPCcoin_1.webp'
                  }
                  alt=""
                  className="coin-face back"
                />
              </div>
              {players
                .map((p, i) => ({ ...p, index: i }))
                .filter((p) => p.position === FINAL_TILE)
                .map((p) => (
                  <Fragment key={`win-${p.index}`}>
                    <PlayerToken
                      photoUrl={p.photoUrl}
                      type={p.type || 'normal'}
                      color={p.color}
                      photoOnly
                      className="board-token"
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
  const [showLobbyConfirm, setShowLobbyConfirm] = useState(false);
  const [showQuitInfo, setShowQuitInfo] = useState(true);
  useTelegramBackButton();
  const navigate = useNavigate();

  useEffect(() => {
    ensureAccountId().catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => setMuted(isGameMuted());
    window.addEventListener('gameMuteChanged', handler);
    return () => window.removeEventListener('gameMuteChanged', handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      const vol = getGameVolume();
      [
        moveSoundRef,
        snakeSoundRef,
        ladderSoundRef,
        winSoundRef,
        diceRewardSoundRef,
        yabbaSoundRef,
        hahaSoundRef,
        oldSnakeSoundRef,
        bombSoundRef,
        usaLeaderSoundRef,
        chinaLeaderSoundRef,
        russiaLeaderSoundRef,
        italyLeaderSoundRef,
        albaniaLeaderSoundRef,
        greeceLeaderSoundRef,
        turkeyLeaderSoundRef,
        ukraineLeaderSoundRef,
        northKoreaLeaderSoundRef,
        egyptLeaderSoundRef,
        englandLeaderSoundRef,
        franceLeaderSoundRef,
        israelLeaderSoundRef,
        serbiaLeaderSoundRef,
        palestineFlagSoundRef,
        badLuckSoundRef,
        cheerSoundRef,
        timerSoundRef,
      ].forEach((r) => {
        if (r.current) r.current.volume = vol;
      });
    };
    window.addEventListener('gameVolumeChanged', handler);
    return () => window.removeEventListener('gameVolumeChanged', handler);
  }, []);

  useEffect(() => {
    let t;
    let cancelled = false;
    ensureAccountId()
      .then((accountId) => {
        if (cancelled || !accountId) return;
        function ping() {
          pingOnline(accountId).catch(() => {});
        }
        ping();
        t = setInterval(ping, 30000);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (t) clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const onDisc = () => setConnectionLost(true);
    const onRec = () => setConnectionLost(false);
    socket.on('disconnect', onDisc);
    socket.io.on('reconnect', onRec);
    return () => {
      socket.off('disconnect', onDisc);
      socket.io.off('reconnect', onRec);
    };
  }, []);
  const [pos, setPos] = useState(0);
  const [highlight, setHighlight] = useState(null); // { cell: number, type: string }
  const [trail, setTrail] = useState([]);
  const [tokenType, setTokenType] = useState("normal");
  const [message, setMessage] = useState("");
  const [messageColor, setMessageColor] = useState("");
  const [turnMessage, setTurnMessage] = useState("Your turn");
  const [diceVisible, setDiceVisible] = useState(true);
  const [photoUrl, setPhotoUrl] = useState(loadAvatar() || '');
  const [myName, setMyName] = useState('You');
  const [pot, setPot] = useState(101);
  const [token, setToken] = useState("TPC");
  const [celebrate, setCelebrate] = useState(false);
  const [leftWinner, setLeftWinner] = useState(null);
  const [disconnectMsg, setDisconnectMsg] = useState(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const [forfeitMsg, setForfeitMsg] = useState(false);
  const [cheatMsg, setCheatMsg] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showExactHelp, setShowExactHelp] = useState(false);
  const [muted, setMuted] = useState(isGameMuted());
  const [snakes, setSnakes] = useState({});
  const [ladders, setLadders] = useState({});
  const [snakeOffsets, setSnakeOffsets] = useState({});
  const [ladderOffsets, setLadderOffsets] = useState({});
  const [offsetPopup, setOffsetPopup] = useState(null); // { cell, type, amount }
  const [rollResult, setRollResult] = useState(null);
  const [diceCells, setDiceCells] = useState({});
  const [bonusDice, setBonusDice] = useState(0);
  const [rewardDice, setRewardDice] = useState(0);
  const [diceCount, setDiceCount] = useState(2);
  const [playerDiceCounts, setPlayerDiceCounts] = useState([2]);
  const [gameOver, setGameOver] = useState(false);
  const [ai, setAi] = useState(0);
  const [aiPositions, setAiPositions] = useState([]);
  const [playerColors, setPlayerColors] = useState([]);
  const [rollColor, setRollColor] = useState('#fff');
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
  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  const [aiAvatars, setAiAvatars] = useState([]);
  const [avatarType, setAvatarType] = useState('flags');
  const [burning, setBurning] = useState([]); // indices of tokens burning
  const [refreshTick, setRefreshTick] = useState(0);
  const [rollCooldown, setRollCooldown] = useState(0);
  const [moving, setMoving] = useState(false);
  const [waitingForPlayers, setWaitingForPlayers] = useState(false);
  const [playersNeeded, setPlayersNeeded] = useState(0);
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [watchOnly, setWatchOnly] = useState(false);
  const [mpPlayers, setMpPlayers] = useState([]);
  const playersRef = useRef([]);
  const [tableId, setTableId] = useState('snake-4');
  const [playerPopup, setPlayerPopup] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [chatBubbles, setChatBubbles] = useState([]);
  const [showWatchWelcome, setShowWatchWelcome] = useState(false);
  const [boardError, setBoardError] = useState(null);

  const diceRef = useRef(null);
  const diceRollerDivRef = useRef(null);
  const [diceStyle, setDiceStyle] = useState({ display: 'none' });
  const [showTrail, setShowTrail] = useState(false);
  const trailTimeoutRef = useRef(null);
  const DICE_SMALL_SCALE = 0.44;
  // Duration for each leg of the dice travel animation (ms)
  // Slightly slower so the movement matches the NFT gift animation
  const DICE_ANIM_DURATION = 1800;
  // Dice landing spot (matches roll result text position)
  const RESULT_BOTTOM = 13 * 16; // tailwind bottom-52 -> 13rem
  // Slightly offset the dice roll landing spot so it sits a bit right and higher
  // Shift the dice landing spot a bit further right so the
  // dice doesn't overlap the roll result number
  const RESULT_OFFSET_X = 36; // shift landing spot slightly further right
  const RESULT_OFFSET_Y = -64; // raise landing spot to match higher result text

  useEffect(() => {
    prepareDiceAnimation(0);
  }, []);


  useEffect(() => {
    return () => clearTimeout(trailTimeoutRef.current);
  }, []);

  // Preload token and avatar images so board icons and AI photos display
  // immediately without waiting for network requests during gameplay.
  useEffect(() => {
    ['TON.webp', 'Usdt.webp'].forEach((file) => {
      const img = new Image();
      img.src = `/assets/icons/${file}`;
    });
    {
      const img = new Image();
      img.src = '/assets/icons/TPCcoin_1.webp';
    }
    AVATARS.forEach((src) => {
      const img = new Image();
      img.src = getAvatarUrl(src);
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
    }, 100);
    return () => clearInterval(id);
  }, [rollCooldown]);

  const getPlayerName = (idx) => {
    if (idx === 0) return myName;
    if (isMultiplayer) {
      return mpPlayers[idx]?.name || `Player ${idx + 1}`;
    }
    const avatar = aiAvatars[idx - 1];
    const name = avatarToName(avatar);
    return name || `AI ${idx}`;
  };

  const playerName = (idx) => (
    <span style={{ color: playerColors[idx] }}>{getPlayerName(idx)}</span>
  );

  const getPlayerAvatar = (idx) => {
    if (idx === 0) return photoUrl;
    if (isMultiplayer) {
      return mpPlayers[idx]?.photoUrl || '';
    }
    return aiAvatars[idx - 1] || '';
  };

  const capturePieces = (cell, mover) => {
    const victims = [];
    if (mover !== 0 && pos === cell) victims.push(0);
    aiPositions.forEach((p, i) => {
      const idx = i + 1;
      if (idx !== mover && p === cell) victims.push(idx);
    });
    if (victims.length && cell > 0) {
      const victimPalestine = victims.some((idx) => {
        const av = getPlayerAvatar(idx);
        return av.includes('Palestine') || av === '🇵🇸';
      });
      if (!muted) {
        bombSoundRef.current.currentTime = 0;
        bombSoundRef.current.play().catch(() => {});
        if (victimPalestine) {
          palestineFlagSoundRef.current.currentTime = 0;
          palestineFlagSoundRef.current.play().catch(() => {});
        } else {
          const avatar = getPlayerAvatar(mover);
          if (avatar.includes('UsaLeader') || avatar === '🇺🇸') {
            usaLeaderSoundRef.current.currentTime = 0;
            usaLeaderSoundRef.current.play().catch(() => {});
          } else if (avatar.includes('ChinaLeader') || avatar === '🇨🇳') {
            chinaLeaderSoundRef.current.currentTime = 0;
            chinaLeaderSoundRef.current.play().catch(() => {});
          } else if (avatar.includes('RussiaLeader') || avatar === '🇷🇺') {
            russiaLeaderSoundRef.current.currentTime = 0;
            russiaLeaderSoundRef.current.play().catch(() => {});
          } else if (avatar.includes('ItalyLeader') || avatar === '🇮🇹') {
            italyLeaderSoundRef.current.currentTime = 0;
            italyLeaderSoundRef.current.play().catch(() => {});
          } else if (avatar.includes('AlbaniaLeader') || avatar === '🇦🇱') {
            albaniaLeaderSoundRef.current.currentTime = 0;
            albaniaLeaderSoundRef.current.play().catch(() => {});
          } else if (avatar.includes('GreeceLeader') || avatar === '🇬🇷') {
            setTimeout(() => {
              greeceLeaderSoundRef.current.currentTime = 0;
              greeceLeaderSoundRef.current.play().catch(() => {});
            }, 1500);
          } else if (avatar.includes('TurkeyLeader') || avatar === '🇹🇷') {
            turkeyLeaderSoundRef.current.currentTime = 0;
            turkeyLeaderSoundRef.current.play().catch(() => {});
          } else if (avatar.includes('NorthKoreaLeader') || avatar === '🇰🇵') {
            northKoreaLeaderSoundRef.current.currentTime = 0;
            northKoreaLeaderSoundRef.current.play().catch(() => {});
          } else if (avatar.includes('UkraineLeader') || avatar === '🇺🇦') {
            ukraineLeaderSoundRef.current.currentTime = 0;
            ukraineLeaderSoundRef.current.play().catch(() => {});
          } else if (avatar.includes('EgyptLeader') || avatar === '🇪🇬') {
            egyptLeaderSoundRef.current.currentTime = 0;
            egyptLeaderSoundRef.current.play().catch(() => {});
          } else if (avatar.includes('UnitedKingdomLeader') || avatar.includes('EnglandLeader') || avatar === '🇬🇧') {
            englandLeaderSoundRef.current.currentTime = 0;
            englandLeaderSoundRef.current.play().catch(() => {});
          } else if (avatar.includes('FranceLeader') || avatar === '🇫🇷') {
            franceLeaderSoundRef.current.currentTime = 0;
            franceLeaderSoundRef.current.play().catch(() => {});
          } else if (avatar.includes('IsraelLeader') || avatar === '🇮🇱') {
            israelLeaderSoundRef.current.currentTime = 0;
            israelLeaderSoundRef.current.play().catch(() => {});
          } else if (avatar.includes('SerbiaLeader') || avatar === '🇷🇸') {
            serbiaLeaderSoundRef.current.currentTime = 0;
            serbiaLeaderSoundRef.current.play().catch(() => {});
          }
        }
      }
      if (cell <= 4 && !muted && !victimPalestine) {
        setTimeout(() => {
          hahaSoundRef.current.currentTime = 0;
          hahaSoundRef.current.play().catch(() => {});
          setTimeout(() => {
            hahaSoundRef.current.pause();
          }, 6000);
        }, 1000);
      }
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

  const getDiceCenter = () => {
    // Landing spot aligns with roll result text
    const cx = window.innerWidth / 2 + RESULT_OFFSET_X;
    const cy = window.innerHeight - RESULT_BOTTOM + RESULT_OFFSET_Y;
    return { cx, cy };
  };

  const prepareDiceAnimation = (startIdx) => {
    if (startIdx == null) {
      const { cx, cy } = getDiceCenter();
      setDiceStyle({
        display: 'block',
        position: 'fixed',
        left: '0px',
        top: '0px',
        transform: `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(1)`,
        transition: 'none',
        pointerEvents: 'none',
        zIndex: 50,
      });
      return;
    }
    const startEl = document.querySelector(`[data-player-index="${startIdx}"] img`);
    if (!startEl) return;
    const s = startEl.getBoundingClientRect();
    const targetX = s.left + s.width / 2;
    // Center the dice on the avatar when it appears
    const targetY = s.top + s.height / 2;
    setDiceStyle({
      display: 'block',
      position: 'fixed',
      left: '0px',
      top: '0px',
      transform: `translate(${targetX}px, ${targetY}px) translate(-50%, -50%) scale(${DICE_SMALL_SCALE})`,
      transition: 'none',
      pointerEvents: 'none',
      zIndex: 50,
    });
  };

  const animateDiceToCenter = (startIdx) => {
    const dice = diceRef.current;
    const startEl = document.querySelector(`[data-player-index="${startIdx}"] img`);
    if (!dice || !startEl) return;
    const s = startEl.getBoundingClientRect();
    const startX = s.left + s.width / 2;
    // Begin animation from the avatar centre
    const startY = s.top + s.height / 2;
    const { cx, cy } = getDiceCenter();
    dice.style.display = 'block';
    dice.style.position = 'fixed';
    dice.style.left = '0px';
    dice.style.top = '0px';
    dice.style.pointerEvents = 'none';
    dice.style.zIndex = '50';
    dice.animate(
      [
        { transform: `translate(${startX}px, ${startY}px) translate(-50%, -50%) scale(${DICE_SMALL_SCALE})` },
        { transform: `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(1)` },
      ],
      { duration: DICE_ANIM_DURATION, easing: 'ease-in-out' },
    ).onfinish = () => {
      setDiceStyle({
        display: 'block',
        position: 'fixed',
        left: '0px',
        top: '0px',
        transform: `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(1)`,
        pointerEvents: 'none',
        zIndex: 50,
      });
    };
  };

  const animateDiceToPlayer = (idx) => {
    const dice = diceRef.current;
    const endEl = document.querySelector(`[data-player-index="${idx}"] img`);
    if (!dice || !endEl) return;
    const e = endEl.getBoundingClientRect();
    // Land slightly to the right of the avatar centre
    const endX = e.left + e.width / 2 + 10;
    const endY = e.top + e.height / 2;
    const { cx, cy } = getDiceCenter();
    dice.animate(
      [
        { transform: `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(1)` },
        { transform: `translate(${endX}px, ${endY}px) translate(-50%, -50%) scale(${DICE_SMALL_SCALE})` },
      ],
      { duration: DICE_ANIM_DURATION, easing: 'ease-in-out' },
    ).onfinish = () => {
      setDiceStyle({
        display: 'block',
        position: 'fixed',
        left: '0px',
        top: '0px',
        transform: `translate(${endX}px, ${endY}px) translate(-50%, -50%) scale(${DICE_SMALL_SCALE})`,
        pointerEvents: 'none',
        zIndex: 50,
      });
    };
  };

  const moveSoundRef = useRef(null);
  const snakeSoundRef = useRef(null);
  const oldSnakeSoundRef = useRef(null);
  const ladderSoundRef = useRef(null);
  const winSoundRef = useRef(null);
  const diceRewardSoundRef = useRef(null);
  const yabbaSoundRef = useRef(null);
  const hahaSoundRef = useRef(null);
  const bombSoundRef = useRef(null);
  const usaLeaderSoundRef = useRef(null);
  const chinaLeaderSoundRef = useRef(null);
  const russiaLeaderSoundRef = useRef(null);
  const italyLeaderSoundRef = useRef(null);
  const albaniaLeaderSoundRef = useRef(null);
  const greeceLeaderSoundRef = useRef(null);
  const turkeyLeaderSoundRef = useRef(null);
  const ukraineLeaderSoundRef = useRef(null);
  const northKoreaLeaderSoundRef = useRef(null);
  const egyptLeaderSoundRef = useRef(null);
  const englandLeaderSoundRef = useRef(null);
  const franceLeaderSoundRef = useRef(null);
  const israelLeaderSoundRef = useRef(null);
  const serbiaLeaderSoundRef = useRef(null);
  const palestineFlagSoundRef = useRef(null);
  const badLuckSoundRef = useRef(null);
  const cheerSoundRef = useRef(null);
  const timerSoundRef = useRef(null);
  const timerRef = useRef(null);
  const aiRollTimeoutRef = useRef(null);
  const reloadingRef = useRef(false);
  const turnEndRef = useRef(Date.now() + TURN_TIME * 1000);
  const aiRollTimeRef = useRef(null);
  const prevTimeLeftRef = useRef(TURN_TIME);

  useEffect(() => {
    const id = getPlayerId();
    const saved = loadAvatar();
    if (saved) {
      setPhotoUrl(saved);
    }
    getProfileByAccount(id)
      .then((p) => {
        if (p?.photo) {
          setPhotoUrl((prev) => prev || p.photo);
          saveAvatar(p.photo);
        }
        setMyName(p?.nickname || `${p?.firstName || ''} ${p?.lastName || ''}`.trim());
      })
      .catch(() => {});
    const vol = getGameVolume();
    moveSoundRef.current = new Audio(dropSound);
    moveSoundRef.current.volume = vol;
    snakeSoundRef.current = new Audio(snakeSound);
    snakeSoundRef.current.volume = vol;
    oldSnakeSoundRef.current = new Audio(dropSound);
    oldSnakeSoundRef.current.volume = vol;
    ladderSoundRef.current = new Audio(ladderSound);
    ladderSoundRef.current.volume = vol;
    winSoundRef.current = new Audio("/assets/sounds/successful.mp3");
    winSoundRef.current.volume = vol;
    diceRewardSoundRef.current = new Audio("/assets/sounds/successful.mp3");
    diceRewardSoundRef.current.volume = vol;
    yabbaSoundRef.current = new Audio("/assets/sounds/yabba-dabba-doo.mp3");
    yabbaSoundRef.current.volume = vol;
    hahaSoundRef.current = new Audio("/assets/sounds/Haha.mp3");
    hahaSoundRef.current.volume = vol;
    bombSoundRef.current = new Audio(bombSound);
    bombSoundRef.current.volume = vol;
    usaLeaderSoundRef.current = new Audio("/assets/sounds/trumpspeach.mp3");
    usaLeaderSoundRef.current.volume = vol;
    chinaLeaderSoundRef.current = new Audio("/assets/sounds/chingpingu.mp3");
    chinaLeaderSoundRef.current.volume = vol;
    russiaLeaderSoundRef.current = new Audio("/assets/sounds/Russia_edit._URA.mp3");
    russiaLeaderSoundRef.current.volume = vol;
    italyLeaderSoundRef.current = new Audio("/assets/sounds/meloni preident 2.mp3");
    italyLeaderSoundRef.current.volume = vol;
    albaniaLeaderSoundRef.current = new Audio("/assets/sounds/Sorry_for_being_balkanik_shorts_youtubeshorts_motorcycle_motoguzziv9_motoguzzi_b.mp3");
    albaniaLeaderSoundRef.current.volume = vol;
    greeceLeaderSoundRef.current = new Audio("/assets/sounds/potukseri.mp3");
    greeceLeaderSoundRef.current.volume = vol;
    turkeyLeaderSoundRef.current = new Audio("/assets/sounds/erdogan.mp3");
    turkeyLeaderSoundRef.current.volume = vol;
    ukraineLeaderSoundRef.current = new Audio("/assets/sounds/2FilesMerged_20250717_131957.mp3");
    ukraineLeaderSoundRef.current.volume = vol;
    northKoreaLeaderSoundRef.current = new Audio("/assets/sounds/Chinese_Gong_Meme_Sound_Effect.mp3");
    northKoreaLeaderSoundRef.current.volume = vol;
    egyptLeaderSoundRef.current = new Audio("/assets/sounds/Ancient_Egyptian_Music__The_Nile_River.mp3");
    egyptLeaderSoundRef.current.volume = vol;
    englandLeaderSoundRef.current = new Audio("/assets/sounds/EnglandLeader.mp3");
    englandLeaderSoundRef.current.volume = vol;
    franceLeaderSoundRef.current = new Audio("/assets/sounds/FranceLeader.mp3");
    franceLeaderSoundRef.current.volume = vol;
    israelLeaderSoundRef.current = new Audio("/assets/sounds/IsraelLeader.mp3");
    israelLeaderSoundRef.current.volume = vol;
    serbiaLeaderSoundRef.current = new Audio("/assets/sounds/SerbiaLeader.mp3");
    serbiaLeaderSoundRef.current.volume = vol;
    palestineFlagSoundRef.current = new Audio('/assets/sounds/palestineflag.mp3');
    palestineFlagSoundRef.current.volume = vol;
    badLuckSoundRef.current = new Audio(badLuckSound);
    badLuckSoundRef.current.volume = vol;
    cheerSoundRef.current = new Audio(cheerSound);
    cheerSoundRef.current.volume = vol;
    timerSoundRef.current = new Audio(timerBeep);
    timerSoundRef.current.volume = vol;
    return () => {
      moveSoundRef.current?.pause();
      snakeSoundRef.current?.pause();
      oldSnakeSoundRef.current?.pause();
      ladderSoundRef.current?.pause();
      winSoundRef.current?.pause();
      diceRewardSoundRef.current?.pause();
      yabbaSoundRef.current?.pause();
      hahaSoundRef.current?.pause();
      bombSoundRef.current?.pause();
      usaLeaderSoundRef.current?.pause();
      chinaLeaderSoundRef.current?.pause();
      russiaLeaderSoundRef.current?.pause();
      italyLeaderSoundRef.current?.pause();
      albaniaLeaderSoundRef.current?.pause();
      greeceLeaderSoundRef.current?.pause();
      turkeyLeaderSoundRef.current?.pause();
      ukraineLeaderSoundRef.current?.pause();
      northKoreaLeaderSoundRef.current?.pause();
      egyptLeaderSoundRef.current?.pause();
      englandLeaderSoundRef.current?.pause();
      franceLeaderSoundRef.current?.pause();
      israelLeaderSoundRef.current?.pause();
      serbiaLeaderSoundRef.current?.pause();
      palestineFlagSoundRef.current?.pause();
      badLuckSoundRef.current?.pause();
      cheerSoundRef.current?.pause();
      timerSoundRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    [
      moveSoundRef,
      snakeSoundRef,
      ladderSoundRef,
      winSoundRef,
      diceRewardSoundRef,
      yabbaSoundRef,
      hahaSoundRef,
      oldSnakeSoundRef,
      bombSoundRef,
      usaLeaderSoundRef,
      chinaLeaderSoundRef,
      russiaLeaderSoundRef,
      italyLeaderSoundRef,
      albaniaLeaderSoundRef,
      greeceLeaderSoundRef,
      turkeyLeaderSoundRef,
      ukraineLeaderSoundRef,
      northKoreaLeaderSoundRef,
      egyptLeaderSoundRef,
      englandLeaderSoundRef,
      franceLeaderSoundRef,
      israelLeaderSoundRef,
      serbiaLeaderSoundRef,
      palestineFlagSoundRef,
      badLuckSoundRef,
      cheerSoundRef,
      timerSoundRef,
    ].forEach((r) => {
      if (r.current) r.current.muted = muted;
    });
  }, [muted]);

  useEffect(() => {
    const updatePhoto = () => {
      const id = getPlayerId();
      const saved = loadAvatar();
      if (saved) {
        setPhotoUrl(saved);
      }
      getProfileByAccount(id)
        .then((p) => {
          setPhotoUrl((prev) => prev || p?.photo || '');
          if (p?.photo) saveAvatar(p.photo);
          setMyName(p?.nickname || `${p?.firstName || ''} ${p?.lastName || ''}`.trim());
        })
        .catch(() => {});
    };
    window.addEventListener("profilePhotoUpdated", updatePhoto);
    return () => window.removeEventListener("profilePhotoUpdated", updatePhoto);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const watchParam = params.get("watch");
    const t = params.get("token");
    const amt = params.get("amount");
    const aiParam = params.get("ai");
    const avatarParam = params.get("avatars") || 'flags';
    const flagsParam = params.get('flags');
    const leadersParam = params.get('leaders');
    const tableParam = params.get("table");
    if (t) setToken(t.toUpperCase());
    if (amt) setPot(Number(amt));
    const aiCount = aiParam
      ? Math.max(1, Math.min(3, Number(aiParam)))
      : tableParam
        ? 0
        : 1;
    setAi(aiCount);
    setAvatarType(avatarParam);
    setIsMultiplayer(tableParam && !aiParam);
    const watching = watchParam === "1";
    setWatchOnly(watching);
    if (watching) {
      setShowQuitInfo(false);
      setShowWatchWelcome(true);
    } else {
      setShowWatchWelcome(false);
    }
    localStorage.removeItem(`snakeGameState_${aiCount}`);
    setAiPositions(Array(aiCount).fill(0));
    setPlayerDiceCounts(Array(aiCount + 1).fill(2));
    if (avatarParam === 'leaders') {
      const isHighStake =
        aiCount === 3 &&
        String(t).toUpperCase() === 'TPC' &&
        Number(amt) === 10000;
      if (leadersParam) {
        const indices = leadersParam
          .split(',')
          .map((n) => parseInt(n))
          .filter((i) => i >= 0 && i < LEADER_AVATARS.length);
        const chosen = indices.map((i) => LEADER_AVATARS[i]);
        while (chosen.length < aiCount) {
          const rand = LEADER_AVATARS[Math.floor(Math.random() * LEADER_AVATARS.length)];
          if (!chosen.includes(rand)) chosen.push(rand);
        }
        setAiAvatars(chosen.slice(0, aiCount));
      } else if (isHighStake) {
        setAiAvatars([
          '/assets/icons/UsaLeader.webp',
          '/assets/icons/RussiaLeader.webp',
          '/assets/icons/ChinaLeader.webp',
        ]);
      } else {
        const unique = [...LEADER_AVATARS]
          .sort(() => Math.random() - 0.5)
          .slice(0, aiCount);
        setAiAvatars(unique);
      }
    } else {
      if (flagsParam) {
        const indices = flagsParam.split(',').map((n) => parseInt(n)).filter((i) => i >= 0 && i < FLAG_EMOJIS.length);
        const chosen = indices.map((i) => FLAG_EMOJIS[i]);
        while (chosen.length < aiCount) {
          chosen.push(FLAG_EMOJIS[Math.floor(Math.random() * FLAG_EMOJIS.length)]);
        }
        setAiAvatars(chosen.slice(0, aiCount));
      } else {
        setAiAvatars(
          Array.from({ length: aiCount }, () =>
            FLAG_EMOJIS[Math.floor(Math.random() * FLAG_EMOJIS.length)]
          )
        );
      }
    }
    const colors = shuffle(TOKEN_COLORS).slice(0, aiCount + 1).map(c => c.color);
    setPlayerColors(colors);

    const storedTable = localStorage.getItem('snakeCurrentTable');
    const table = params.get("table") || storedTable || "snake-4";
    setTableId(table);
    localStorage.setItem('snakeCurrentTable', table);
    const boardPromise = isMultiplayer
      ? getSnakeBoard(table)
      : Promise.resolve(generateBoard());
    boardPromise
      .then(({ snakes: snakesObj = {}, ladders: laddersObj = {} }) => {
        setBoardError(null);
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
          } while (
            usedD.has(String(cell)) ||
            usedD.has(cell) ||
            cell === FINAL_TILE ||
            cell === 1
          );
          diceMap[cell] = val;
          usedD.add(cell);
        });
        setDiceCells(diceMap);
      })
      .catch((err) => {
        console.error(err);
        setBoardError('Failed to load board. Please try again.');
      });
  }, []);

  useEffect(() => {
    playersRef.current = mpPlayers;
  }, [mpPlayers]);

  useEffect(() => {
    if (isMultiplayer) {
      localStorage.setItem('snakeCurrentTable', tableId);
    } else {
      localStorage.removeItem('snakeCurrentTable');
    }
  }, [isMultiplayer, tableId]);

  useEffect(() => {
    if (!isMultiplayer) return;
    const accountId = getPlayerId();
    const name = myName;
    const parts = tableId.split('-');
    const capacity = parseInt(parts[1], 10) || 0;
    if (!watchOnly) {
      setWaitingForPlayers(true);
      setPlayersNeeded(capacity);
    } else {
      setWaitingForPlayers(false);
    }

    const updateNeeded = (players) => {
      // Deduplicate by player id so repeated entries do not skew the count
      const unique = Array.from(new Set(players.map((p) => p.id)));
      const need = Math.max(0, capacity - unique.length);
      setPlayersNeeded(need);
      if (need === 0) setWaitingForPlayers(false);
    };

    const onJoined = ({ playerId }) => {
      getProfileByAccount(playerId).then((prof) => {
        const name = prof?.nickname || `${prof?.firstName || ''} ${prof?.lastName || ''}`.trim() || `Player`;
        const photoUrl = prof?.photo || '/assets/icons/profile.svg';
        setMpPlayers((p) => {
          if (p.some((pl) => pl.id === playerId)) {
            updateNeeded(p);
            return p;
          }
          const arr = [...p, { id: playerId, name, photoUrl, position: 0 }];
          updateNeeded(arr);
          return arr;
        });
      });
    };
    const onLeft = ({ playerId }) => {
      setMpPlayers((p) => {
        const leaving = p.find((pl) => pl.id === playerId);
        const arr = p.filter((pl) => pl.id !== playerId);
        updateNeeded(arr);
        if (leaving && !ranking.includes(leaving.name)) {
          setRanking((r) => [...r, leaving.name]);
        }
        if (leaving) {
          if (playerId === accountId) {
            setForfeitMsg(true);
          } else if (arr.length === 1 && capacity === 2) {
            setLeftWinner(leaving.name);
          } else if (capacity > 2) {
            setDisconnectMsg(`${leaving.name} forfeited`);
            setTimeout(() => setDisconnectMsg(null), 3000);
          }
        }
        return arr;
      });
    };
    const onMove = ({ playerId, from = 0, to }) => {
      const updatePosition = (pos) => {
        setMpPlayers((p) => p.map((pl) => (pl.id === playerId ? { ...pl, position: pos } : pl)));
        if (playerId === accountId) setPos(pos);
      };
      const ctx = {
        updatePosition,
        setHighlight,
        setTrail,
        moveSoundRef,
        hahaSoundRef,
        snakes,
        ladders,
        setOffsetPopup,
        snakeSoundRef,
        oldSnakeSoundRef,
        ladderSoundRef,
        badLuckSoundRef,
        muted,
        FINAL_TILE,
      };
      const finalizeMove = (finalPos, type) => {
        updatePosition(finalPos);
        setHighlight({ cell: finalPos, type });
        setTrail([]);
        setTimeout(() => setHighlight(null), 2300);
        setMoving(false);
      };
      const seq = [];
      for (let i = from + 1; i <= to; i++) seq.push(i);
      setMoving(true);
      moveSeq(seq, 'normal', ctx, () => finalizeMove(to, 'normal'), 'forward');
    };
    const onSnakeOrLadder = ({ playerId, from, to }) => {
      const updatePosition = (pos) => {
        setMpPlayers((p) => p.map((pl) => (pl.id === playerId ? { ...pl, position: pos } : pl)));
        if (playerId === accountId) setPos(pos);
      };
      const ctx = {
        updatePosition,
        setHighlight,
        setTrail,
        moveSoundRef,
        hahaSoundRef,
        snakes,
        ladders,
        setOffsetPopup,
        snakeSoundRef,
        oldSnakeSoundRef,
        ladderSoundRef,
        badLuckSoundRef,
        muted,
        FINAL_TILE,
      };
      const finalizeMove = (finalPos, type) => {
        updatePosition(finalPos);
        setHighlight({ cell: finalPos, type });
        setTrail([]);
        setTimeout(() => setHighlight(null), 2300);
        setMoving(false);
      };
      setMoving(true);
      applyEffectHelper(from, ctx, finalizeMove);
    };
    const onReset = ({ playerId }) => {
      const idx = playersRef.current.findIndex((pl) => pl.id === playerId);
      if (idx === -1) return;
      setBurning((b) => [...b, idx]);
      if (!muted) {
        bombSoundRef.current.currentTime = 0;
        bombSoundRef.current.play().catch(() => {});
        hahaSoundRef.current.currentTime = 0;
        hahaSoundRef.current.play().catch(() => {});
      }
      setTimeout(() => {
        setBurning((b) => b.filter((v) => v !== idx));
        setMpPlayers((p) => p.map((pl) => (pl.id === playerId ? { ...pl, position: 0 } : pl)));
        if (playerId === accountId) setPos(0);
      }, 1000);
    };
    const onTurn = ({ playerId }) => {
      const idx = playersRef.current.findIndex((pl) => pl.id === playerId);
      if (idx >= 0) {
        setCurrentTurn(idx);
        setDiceCount(playerDiceCounts[idx] ?? 2);
      }
    };
    const onStarted = () => {
      setWaitingForPlayers(false);
      unseatTable(accountId, tableId).catch(() => {});
    };
    const onRolled = ({ value }) => {
      setRollResult(value);
      setTimeout(() => setRollResult(null), 2000);
    };
    const onWon = ({ playerId }) => {
      setGameOver(true);
      const winnerName = playerId === accountId ? myName : playerId;
      setRanking((r) => {
        const others = r.filter((n) => n !== winnerName);
        return [winnerName, ...others];
      });
      if (playerId === accountId) {
        const totalPlayers = isMultiplayer ? mpPlayers.length : ai + 1;
        const tgId = getTelegramId();
        addTransaction(tgId, 0, 'win', {
          game: 'snake',
          players: totalPlayers,
          accountId
        });
      }
    };

    const onCurrentPlayers = (players) => {
      Promise.all(
        players.map(async (p) => {
          const prof = await getProfileByAccount(p.playerId).catch(() => ({}));
          const name = prof?.nickname || `${prof?.firstName || ''} ${prof?.lastName || ''}`.trim() || p.name;
          const photoUrl = prof?.photo || '/assets/icons/profile.svg';
          return { id: p.playerId, name, photoUrl, position: p.position || 0 };
        })
      ).then((arr) => {
        const unique = [];
        const seen = new Set();
        for (const p of arr) {
          if (!seen.has(p.id)) {
            seen.add(p.id);
            unique.push(p);
          }
        }
        setMpPlayers(unique);
        updateNeeded(unique);
      });
    };

    socket.on('playerJoined', onJoined);
    socket.on('playerLeft', onLeft);
    socket.on('playerDisconnected', ({ playerId }) => {
      if (playerId === accountId) {
        setConnectionLost(true);
      } else if (capacity > 2) {
        const name = playersRef.current.find((p) => p.id === playerId)?.name || playerId;
        setDisconnectMsg(`${name} disconnected`);
        setTimeout(() => setDisconnectMsg(null), 3000);
      }
    });
    socket.on('playerRejoined', ({ playerId }) => {
      if (playerId === accountId) {
        setConnectionLost(false);
      } else if (capacity > 2) {
        const name = playersRef.current.find((p) => p.id === playerId)?.name || playerId;
        setDisconnectMsg(`${name} rejoined`);
        setTimeout(() => setDisconnectMsg(null), 3000);
      }
    });
    socket.on('cheatWarning', ({ reason, count }) => {
      setCheatMsg(`Cheating detected: ${reason} (${count}/3)`);
    });
    socket.on('movePlayer', onMove);
    socket.on('snakeOrLadder', onSnakeOrLadder);
    socket.on('playerReset', onReset);
    socket.on('turnChanged', onTurn);
    socket.on('gameStarted', onStarted);
    socket.on('diceRolled', onRolled);
    socket.on('gameWon', onWon);
    socket.on('currentPlayers', onCurrentPlayers);

    if (watchOnly) {
      socket.emit('watchRoom', { roomId: tableId });
      getSnakeLobby(tableId)
        .then((data) => {
          const players = data.players || [];
          return Promise.all(
            players.map(async (p) => {
              const prof = await getProfileByAccount(p.id).catch(() => ({}));
              const n =
                prof?.nickname || `${prof?.firstName || ''} ${prof?.lastName || ''}`.trim() || p.name;
              const photoUrl = prof?.photo || '/assets/icons/profile.svg';
              return { id: p.id, name: n, photoUrl, position: 0 };
            })
          ).then((arr) => {
            setMpPlayers(arr);
            setPlayersNeeded(Math.max(0, capacity - arr.length));
          });
        })
        .catch(() => {});
    } else {
      socket.emit('joinRoom', { roomId: tableId, accountId, name });
    }


    return () => {
      socket.off('playerJoined', onJoined);
      socket.off('playerLeft', onLeft);
      socket.off('playerDisconnected');
      socket.off('playerRejoined');
      socket.off('cheatWarning');
      socket.off('movePlayer', onMove);
      socket.off('snakeOrLadder', onSnakeOrLadder);
      socket.off('playerReset', onReset);
      socket.off('turnChanged', onTurn);
      socket.off('gameStarted', onStarted);
      socket.off('diceRolled', onRolled);
      socket.off('gameWon', onWon);
      socket.off('currentPlayers', onCurrentPlayers);
      if (watchOnly) {
        socket.emit('leaveWatch', { roomId: tableId });
      } else {
        unseatTable(accountId, tableId).catch(() => {});
      }
    };
  }, [isMultiplayer, tableId, watchOnly]);

  const fastForward = (elapsed, state) => {
    let p = state.pos ?? 0;
    let aiPos = [...(state.aiPositions ?? Array(ai).fill(0))];
    let turn = state.currentTurn ?? 0;
    let rank = [...(state.ranking ?? [])];
    let over = state.gameOver ?? false;
    while (elapsed > 0 && !over) {
      const roll = Math.floor(Math.random() * 6) + 1;
      if (turn === 0) {
        if (p === 0) {
          if (roll === 6) p = 1;
        } else if (p + roll <= FINAL_TILE) {
          p += roll;
        }
        if (state.snakes[p] != null) p = Math.max(0, state.snakes[p]);
        else if (state.ladders[p] != null) {
          const lad = state.ladders[p];
          p = typeof lad === 'object' ? lad.end : lad;
        }
        aiPos = aiPos.map((pos) => (pos === p ? 0 : pos));
        if (p === FINAL_TILE && !rank.includes('You')) {
          rank.push('You');
          if (rank.length === 1) over = true;
        }
      } else {
        let idx = turn - 1;
        let pos = aiPos[idx];
        if (pos === 0) {
          if (roll === 6) pos = 1;
        } else if (pos + roll <= FINAL_TILE) {
          pos += roll;
        }
        if (state.snakes[pos] != null) pos = Math.max(0, state.snakes[pos]);
        else if (state.ladders[pos] != null) {
          const lad = state.ladders[pos];
          pos = typeof lad === 'object' ? lad.end : lad;
        }
        if (p === pos) p = 0;
        aiPos = aiPos.map((v, i) => (i === idx ? pos : v === pos ? 0 : v));
        if (pos === FINAL_TILE && !rank.includes(getPlayerName(turn))) {
          rank.push(getPlayerName(turn));
          if (rank.length === 1) over = true;
        }
      }
      turn = (turn + 1) % (ai + 1);
      elapsed -= 2500;
    }
    setPos(p);
    setAiPositions(aiPos);
    setCurrentTurn(turn);
    setDiceCount(playerDiceCounts[turn] ?? 2);
    setRanking(rank);
    setGameOver(over);
    if (over) {
      localStorage.removeItem(`snakeGameState_${ai}`);
    }
  };

  useEffect(() => {
    const key = `snakeGameState_${ai}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const limit = (obj) =>
          Object.fromEntries(Object.entries(obj).slice(0, 8));
        const data = JSON.parse(stored);
        if (data.gameOver) {
          localStorage.removeItem(key);
        } else {
          setPos(data.pos ?? 0);
          setAiPositions(data.aiPositions ?? Array(ai).fill(0));
          setCurrentTurn(data.currentTurn ?? 0);
          setDiceCount(playerDiceCounts[data.currentTurn ?? 0] ?? 2);
          setDiceCells(data.diceCells ?? {});
          setSnakes(limit(data.snakes ?? {}));
          setLadders(limit(data.ladders ?? {}));
          setSnakeOffsets(limit(data.snakeOffsets ?? {}));
          setLadderOffsets(limit(data.ladderOffsets ?? {}));
          setRanking(data.ranking ?? []);
          setGameOver(false);
          if (Array.isArray(data.aiAvatars)) {
            setAiAvatars(data.aiAvatars);
          }
          if (data.timestamp) {
            const elapsed = Date.now() - data.timestamp;
            if (elapsed > 0) fastForward(elapsed, data);
          }
        }
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
      aiAvatars,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  }, [ai, pos, aiPositions, currentTurn, diceCells, snakes, ladders, snakeOffsets, ladderOffsets, ranking, gameOver]);

  // Ensure stored state is cleared when leaving the page
  useEffect(() => {
    const key = `snakeGameState_${ai}`;
    const handleUnload = (e) => {
      localStorage.removeItem(key);
      if (!gameOver) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      localStorage.removeItem(key);
    };
  }, [ai, gameOver]);



  const handleRoll = (values) => {
    setMoving(true);
    setTurnMessage("");
    setRollCooldown(1);
    const value = Array.isArray(values)
      ? values.reduce((a, b) => a + b, 0)
      : values;
    const rolledSix = Array.isArray(values)
      ? values.some((v) => Number(v) === 6)
      : Number(value) === 6;
    const doubleSix = Array.isArray(values) && values[0] === 6 && values[1] === 6;

    setRollColor(playerColors[0] || '#fff');

    // Predict capture for laugh sound
    let preview = pos;
    if (preview === 0) {
      if (rolledSix) preview = 1;
    } else if (preview === 100 && diceCount === 1) {
      if (value === 1) preview = FINAL_TILE;
    } else if (preview !== 100 || diceCount !== 2) {
      if (preview + value <= FINAL_TILE) preview = preview + value;
    }
    if (snakes[preview] != null) preview = Math.max(0, snakes[preview]);
    else if (ladders[preview] != null) {
      const ladObj = ladders[preview];
      preview = typeof ladObj === 'object' ? ladObj.end : ladObj;
    }
    const willCapture = aiPositions.some((p) => p === preview);

    setRollResult(value);
    if (doubleSix && !muted) {
      yabbaSoundRef.current.currentTime = 0;
      yabbaSoundRef.current.play().catch(() => {});
    }
    if (willCapture && preview > 4 && !muted) {
      hahaSoundRef.current.currentTime = 0;
      hahaSoundRef.current.play().catch(() => {});
    }
    setTimeout(() => setRollResult(null), 2000);

    setTimeout(() => {
      setDiceVisible(false);
      setOffsetPopup(null);
      setTrail([]);


      setMessage("");
      let current = pos;
      let target = current;

      if (current === 100 && diceCount === 2) {
        if (rolledSix) {
          setDiceCount(1);
          setPlayerDiceCounts((arr) => {
            const copy = [...arr];
            copy[currentTurn] = 1;
            return copy;
          });
          setMessage("Six rolled! One die removed.");
        } else {
          setMessage("");
        }
        setTurnMessage("Your turn");
        setDiceVisible(true);
        setMoving(false);
        return;
      } else if (current === 100 && diceCount === 1) {
        if (value === 1) {
          target = FINAL_TILE;
        } else {
          setMessage("Need a 1 to win!");
          setTurnMessage("");
          setDiceVisible(false);
          const next = (currentTurn + 1) % (ai + 1);
          animateDiceToPlayer(next);
          setTimeout(() => {
            setCurrentTurn(next);
            setDiceCount(playerDiceCounts[next] ?? 2);
          }, 2000);
          setTimeout(() => setMoving(false), 2000);
          return;
        }
      } else if (current === 0) {
        if (rolledSix) {
          target = 1;
          if (!muted) cheerSoundRef.current?.play().catch(() => {});
        }
        else {
          setMessage("");
          setTurnMessage("");
          setDiceVisible(false);
          const next = (currentTurn + 1) % (ai + 1);
          animateDiceToPlayer(next);
          setTimeout(() => {
            setCurrentTurn(next);
            setDiceCount(playerDiceCounts[next] ?? 2);
          }, 2000);
          setTimeout(() => setMoving(false), 2000);
          return;
        }
      } else if (current + value <= FINAL_TILE) {
        target = current + value;
      } else {
        setMessage("Need exact roll!");
        setShowExactHelp(true);
        setTurnMessage("");
        setDiceVisible(false);
        const next = (currentTurn + 1) % (ai + 1);
        animateDiceToPlayer(next);
        setTimeout(() => {
          setCurrentTurn(next);
          setDiceCount(playerDiceCounts[next] ?? 2);
        }, 2000);
        setTimeout(() => setMoving(false), 2000);
        return;
      }


      let predicted = target;
      if (snakes[predicted] != null) predicted = Math.max(0, snakes[predicted]);
      else if (ladders[predicted] != null) {
        const ladObj = ladders[predicted];
        predicted = typeof ladObj === 'object' ? ladObj.end : ladObj;
      }
      const extraPred = diceCells[predicted] || doubleSix;
      const nextPlayer = extraPred ? currentTurn : (currentTurn + 1) % (ai + 1);
      animateDiceToPlayer(nextPlayer);

      const steps = [];
      for (let i = current + 1; i <= target; i++) steps.push(i);

        setHighlight(null);
      const ctx = {
        updatePosition: (p) => setPos(p),
        setHighlight,
        setTrail,
        moveSoundRef,
        hahaSoundRef,
        snakes,
        ladders,
        setOffsetPopup,
        snakeSoundRef,
        oldSnakeSoundRef,
        ladderSoundRef,
        badLuckSoundRef,
        muted,
        FINAL_TILE,
      };

      const applyEffect = (startPos) =>
        applyEffectHelper(startPos, ctx, finalizeMove);

      const finalizeMove = (finalPos, type) => {
        setPos(finalPos);
        setHighlight({ cell: finalPos, type });
        setTrail([]);
        setTokenType(type);
        setTimeout(() => setHighlight(null), 2300);
        capturePieces(finalPos, 0);
        if (finalPos === FINAL_TILE && !ranking.includes('You')) {
          const first = ranking.length === 0;
          const total = pot * (ai + 1);
          if (first) {
            ensureAccountId()
              .then(async (aid) => {
                const winAmt = Math.round(total * 0.91);
                await Promise.all([
                  depositAccount(aid, winAmt, { game: 'snake-win' }),
                  awardDevShare(total),
                ]);
              })
              .catch(() => {});
          }
          setRanking((r) => [...r, 'You']);
          if (first) setGameOver(true);
          const winAmt = Math.round(total * 0.91);
          setMessage(`You win ${winAmt} ${token}!`);
          setMessageColor("");
          if (!muted) winSoundRef.current?.play().catch(() => {});
          coinConfetti(50);
          setCelebrate(true);
          setTimeout(() => {
            setCelebrate(false);
            setDiceCount(2);
            setPlayerDiceCounts((arr) => {
              const copy = [...arr];
              copy[currentTurn] = 2;
              return copy;
            });
          }, 2000);
        }
        let extraTurn = false;
        if (diceCells[finalPos]) {
          const bonus = diceCells[finalPos];
          setDiceCells((d) => {
            const n = { ...d };
            delete n[finalPos];
            return n;
          });
          setBonusDice(bonus);
          setRewardDice(bonus);
          setTurnMessage('Bonus roll');
          extraTurn = true;
          if (!muted) {
            diceRewardSoundRef.current?.play().catch(() => {});
            yabbaSoundRef.current?.play().catch(() => {});
          }
          setTimeout(() => setRewardDice(0), 1000);
        } else if (doubleSix) {
          setTurnMessage('Double six! Roll again');
          setBonusDice(0);
          extraTurn = true;
        } else {
          setTurnMessage("Your turn");
          setBonusDice(0);
        }
        setDiceVisible(true);
        setMoving(false);
        if (!gameOver) {
          const next = extraTurn ? currentTurn : (currentTurn + 1) % (ai + 1);
          setCurrentTurn(next);
          setDiceCount(playerDiceCounts[next] ?? 2);
        }
      };

      moveSeq(steps, 'normal', ctx, () => applyEffect(target), 'forward');
    }, 2000);
  };

  const triggerAIRoll = (index) => {
    setAiRollingIndex(index);
    setTurnMessage(<>{playerName(index)} rolling...</>);
    setAiRollTrigger((t) => t + 1);
    setDiceVisible(true);
  };

  const handleAIRoll = (index, vals) => {
    setMoving(true);
    const value = Array.isArray(vals)
      ? vals.reduce((a, b) => a + b, 0)
      : vals ?? Math.floor(Math.random() * 6) + 1;
    const rolledSix = Array.isArray(vals)
      ? vals.some((v) => Number(v) === 6)
      : Number(value) === 6;
    const doubleSix = Array.isArray(vals) && vals[0] === 6 && vals[1] === 6;
    setRollColor(playerColors[index] || '#fff');

    let preview = aiPositions[index - 1];
    if (preview === 0) {
      if (rolledSix) preview = 1;
    } else if (preview === 100) {
      if (value === 1) preview = FINAL_TILE;
    } else if (preview + value <= FINAL_TILE) {
      preview = preview + value;
    }
    if (snakes[preview] != null) preview = Math.max(0, snakes[preview]);
    else if (ladders[preview] != null) {
      const ladObj = ladders[preview];
      preview = typeof ladObj === 'object' ? ladObj.end : ladObj;
    }
    const capture =
      (index !== 0 && pos === preview) ||
      aiPositions.some((p, i) => i !== index - 1 && p === preview);

    setTurnMessage(<>{playerName(index)} rolled {value}</>);
    setRollResult(value);
    if (doubleSix && !muted) {
      yabbaSoundRef.current.currentTime = 0;
      yabbaSoundRef.current.play().catch(() => {});
    }
    if (capture && preview > 4 && !muted) {
      hahaSoundRef.current.currentTime = 0;
      hahaSoundRef.current.play().catch(() => {});
    }
    setTimeout(() => setRollResult(null), 2000);
    setTimeout(() => {
      setDiceVisible(false);
    let positions = [...aiPositions];
    let current = positions[index - 1];
    let target = current;
    if (current === 0) {
      if (rolledSix) {
        target = 1;
        if (!muted) cheerSoundRef.current?.play().catch(() => {});
      }
    } else if (current === 100 && playerDiceCounts[index] === 2) {
      if (rolledSix) {
        setPlayerDiceCounts(arr => {
          const copy = [...arr];
          copy[index] = 1;
          return copy;
        });
        if (currentTurn === index) setDiceCount(1);
        setTurnMessage(`${getPlayerName(index)}'s turn`);
        setDiceVisible(true);
        setMoving(false);
        return;
      } else {
        setTurnMessage(`${getPlayerName(index)} needs a 6`);
        setDiceVisible(false);
        const next = (currentTurn + 1) % (ai + 1);
        animateDiceToPlayer(next);
        setTimeout(() => {
          setCurrentTurn(next);
          setDiceCount(playerDiceCounts[next] ?? 2);
        }, 2000);
        setTimeout(() => setMoving(false), 2000);
        return;
      }
    } else if (current === 100 && playerDiceCounts[index] === 1) {
      if (value === 1) target = FINAL_TILE;
      else {
        setTurnMessage('');
        setDiceVisible(false);
        const next = (currentTurn + 1) % (ai + 1);
        animateDiceToPlayer(next);
        setTimeout(() => {
          setCurrentTurn(next);
          setDiceCount(playerDiceCounts[next] ?? 2);
        }, 2000);
        setTimeout(() => setMoving(false), 2000);
        return;
      }
    } else if (current + value <= FINAL_TILE) {
      target = current + value;
    }

    let predicted = target;
    if (snakes[predicted] != null) predicted = Math.max(0, snakes[predicted]);
    else if (ladders[predicted] != null) {
      const ladObj = ladders[predicted];
      predicted = typeof ladObj === 'object' ? ladObj.end : ladObj;
    }
    const extraPred = diceCells[predicted] || doubleSix;
    const nextPlayer = extraPred ? index : (index + 1) % (ai + 1);
    animateDiceToPlayer(nextPlayer);

    const steps = [];
    for (let i = current + 1; i <= target; i++) steps.push(i);

      setHighlight(null);
    const ctx = {
      updatePosition: (p) => {
        positions[index - 1] = p;
        setAiPositions([...positions]);
      },
      setHighlight,
      setTrail,
      moveSoundRef,
      hahaSoundRef,
      snakes,
      ladders,
      setOffsetPopup,
      snakeSoundRef,
      oldSnakeSoundRef,
      ladderSoundRef,
      badLuckSoundRef,
      muted,
      FINAL_TILE,
    };

    const finalizeMove = async (finalPos, type) => {
      positions[index - 1] = finalPos;
      setAiPositions([...positions]);
      setHighlight({ cell: finalPos, type });
      setTrail([]);
      capturePieces(finalPos, index);
      setTimeout(() => setHighlight(null), 2300);
      if (finalPos === FINAL_TILE && !ranking.includes(getPlayerName(index))) {
        const first = ranking.length === 0;
        setRanking(r => [...r, getPlayerName(index)]);
        if (first) {
          await awardDevShare(pot * (ai + 1));
          setGameOver(true);
        }
        setMessage(`${getPlayerName(index)} wins!`);
        setPlayerDiceCounts(arr => {
          const copy = [...arr];
          copy[index] = 2;
          return copy;
        });
        setDiceVisible(false);
        setMoving(false);
        return;
      }
      let extraTurn = false;
      if (diceCells[finalPos]) {
        const bonus = diceCells[finalPos];
        setDiceCells((d) => {
          const n = { ...d };
          delete n[finalPos];
          return n;
        });
        setBonusDice(bonus);
        setRewardDice(bonus);
        setTurnMessage('Bonus roll');
        extraTurn = true;
        if (!muted) {
          diceRewardSoundRef.current?.play().catch(() => {});
          yabbaSoundRef.current?.play().catch(() => {});
        }
        setTimeout(() => setRewardDice(0), 1000);
      } else if (doubleSix) {
        extraTurn = true;
      }
      const next = extraTurn ? index : (index + 1) % (ai + 1);
      if (next === 0) setTurnMessage('Your turn');
      setCurrentTurn(next);
      setDiceCount(playerDiceCounts[next] ?? 2);
      setDiceVisible(true);
      setMoving(false);
      if (extraTurn && next === index) {
        setTimeout(() => triggerAIRoll(index), 1800);
      }
    };

    const applyEffect = (startPos) => applyEffectHelper(startPos, ctx, finalizeMove);

    moveSeq(steps, 'normal', ctx, () => applyEffect(target), 'forward');
    }, 2000);
  };

  useEffect(() => {
    if (waitingForPlayers || !setupPhase || boardError || aiPositions.length !== ai) return;
    const total = ai + 1;
    if (total === 1) {
      setSetupPhase(false);
      setTurnMessage('Your turn');
      setCurrentTurn(0);
      setDiceCount(playerDiceCounts[0] ?? 2);
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
                {i > 0 && ', '} {getPlayerName(r.index)}({r.roll})
              </span>
            ))}
            . {getPlayerName(first.index)} start first.
          </>
        );
        setTimeout(() => {
          setSetupPhase(false);
          setDiceVisible(true);
          setCurrentTurn(first.index);
          setDiceCount(playerDiceCounts[first.index] ?? 2);
        }, 2000);
        return;
      }
      const idxPlayer = rollOrder[idx];
      const roll = Math.floor(Math.random() * 6) + 1;
      results.push({ index: idxPlayer, roll });
      setTurnMessage(<>{playerName(idxPlayer)} rolled {roll}</>);
      setTimeout(() => rollNext(idx + 1), 1000);
    };
    rollNext(0);
  }, [ai, aiPositions, setupPhase, boardError]);


  useEffect(() => {
    if (!setupPhase && currentTurn === 0 && !gameOver) {
      setTurnMessage('Your turn');
    }
  }, [currentTurn, setupPhase, gameOver, refreshTick, moving]);

  // Failsafe: ensure AI roll proceeds even if dice animation doesn't start
  useEffect(() => {
    if (aiRollingIndex != null) {
      if (aiRollTimeoutRef.current) clearTimeout(aiRollTimeoutRef.current);
      aiRollTimeoutRef.current = setTimeout(() => {
        setAiRollTrigger((t) => t + 1);
      }, 1800);
      return () => clearTimeout(aiRollTimeoutRef.current);
    }
  }, [aiRollingIndex]);

  useEffect(() => {
    if (setupPhase || gameOver || moving) return;

    const myIndex = isMultiplayer
      ? mpPlayers.findIndex((p) => p.id === getPlayerId())
      : 0;

    if (currentTurn !== myIndex) {
      turnEndRef.current = Date.now() + TURN_TIME * 1000;
      prevTimeLeftRef.current = TURN_TIME;
      setTimeLeft(TURN_TIME);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        const remaining = Math.max(
          0,
          (turnEndRef.current - Date.now()) / 1000
        );
        prevTimeLeftRef.current = remaining;
        setTimeLeft(parseFloat(remaining.toFixed(1)));
      }, 100);
      if (!isMultiplayer) {
        aiRollTimeRef.current = Date.now() + 2500;
        if (aiRollTimeoutRef.current) clearInterval(aiRollTimeoutRef.current);
        aiRollTimeoutRef.current = setInterval(() => {
          if (Date.now() >= aiRollTimeRef.current) {
            clearInterval(aiRollTimeoutRef.current);
            triggerAIRoll(currentTurn);
          }
        }, 100);
      }
      return () => {
        clearInterval(timerRef.current);
        clearInterval(aiRollTimeoutRef.current);
      };
    }

    const limit = TURN_TIME;
    turnEndRef.current = Date.now() + limit * 1000;
    prevTimeLeftRef.current = limit;
    setTimeLeft(limit);
    if (timerRef.current) clearInterval(timerRef.current);
    if (timerSoundRef.current) timerSoundRef.current.pause();
    timerRef.current = setInterval(() => {
      const remaining = Math.max(
        0,
        (turnEndRef.current - Date.now()) / 1000
      );
      const next = parseFloat(remaining.toFixed(1));
      if (
        currentTurn === myIndex &&
        Math.ceil(next) < Math.ceil(prevTimeLeftRef.current) &&
        next <= 7 &&
        next >= 0 &&
        timerSoundRef.current
      ) {
        timerSoundRef.current.currentTime = 0;
        if (!muted) timerSoundRef.current.play().catch(() => {});
      }
      if (next <= 0) {
        timerSoundRef.current?.pause();
        clearInterval(timerRef.current);
        setPlayerAutoRolling(true);
        setTurnMessage('Rolling...');
        setPlayerRollTrigger((r) => r + 1);
      }
      prevTimeLeftRef.current = next;
      setTimeLeft(next);
    }, 100);
    return () => {
      clearInterval(timerRef.current);
      timerSoundRef.current?.pause();
    };
  }, [currentTurn, setupPhase, gameOver, moving, isMultiplayer, mpPlayers, muted]);

  // Periodically refresh the component state to avoid freezes
  useEffect(() => {
    const id = setInterval(() => {
      setRefreshTick((t) => t + 1);
    }, 5000);
    return () => clearInterval(id);
  }, []);



  const players = isMultiplayer
    ? mpPlayers.map((p, i) => ({
        id: p.id,
        position: p.position,
        photoUrl: p.photoUrl || '/assets/icons/profile.svg',
        type: 'normal',
        color: playerColors[i] || '#fff'
      }))
    : [
        { position: pos, photoUrl, type: tokenType, color: playerColors[0] },
        ...aiPositions.map((p, i) => ({
          position: p,
          photoUrl: aiAvatars[i] || '/assets/icons/profile.svg',
          type: 'normal',
          color: playerColors[i + 1]
        }))
      ];

  // determine ranking numbers based on board positions
  const rankMap = {};
  players
    .map((p, i) => ({ idx: i, pos: p.position }))
    .sort((a, b) => b.pos - a.pos)
    .forEach((p, i) => {
      rankMap[p.idx] = p.pos === 0 ? 0 : i + 1;
    });


  return (
    <div className="p-4 pb-32 space-y-4 text-text flex flex-col justify-end items-center relative w-full flex-grow">
      {/* Bottom left controls */}
      <BottomLeftIcons
        onInfo={() => setShowInfo(true)}
        onChat={() => setShowChat(true)}
        onGift={() => setShowGift(true)}
      />
      {/* Player photos stacked vertically */}
        <div className="fixed left-0 top-[45%] -translate-x-1 -translate-y-1/2 flex flex-col space-y-5 z-20">
        {players
          .map((p, i) => ({ ...p, index: i }))
          .map((p) => (
            <AvatarTimer
              key={`player-${p.index}`}
              index={p.index}
              photoUrl={p.photoUrl}
              active={p.index === currentTurn}
              rank={rankMap[p.index]}
              name={getPlayerName(p.index)}
              isTurn={p.index === currentTurn}
              timerPct={
                p.index === currentTurn
                  ? timeLeft / TURN_TIME
                  : 1
              }
              color={p.color}
              onClick={() => {
                const myIdx = isMultiplayer
                  ? mpPlayers.findIndex(pl => pl.id === getPlayerId())
                  : 0;
                if (p.index !== myIdx) setPlayerPopup(p);
              }}
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
      {chatBubbles.map((b) => (
        <div key={b.id} className="chat-bubble">
          <span>{b.text}</span>
          <img src={b.photoUrl} className="w-6 h-6 rounded-full" />
        </div>
      ))}
      <PlayerPopup
        open={!!playerPopup}
        player={playerPopup}
        onClose={() => setPlayerPopup(null)}
      />
      <QuickMessagePopup
        open={showChat}
        onClose={() => setShowChat(false)}
        onSend={(text) => {
          const id = Date.now();
          setChatBubbles((b) => [...b, { id, text, photoUrl }]);
          if (!muted) {
            const a = new Audio(chatBeep);
            a.volume = getGameVolume();
            a.play().catch(() => {});
          }
          setTimeout(
            () => setChatBubbles((b) => b.filter((bb) => bb.id !== id)),
            3000,
          );
        }}
      />
      {(() => {
        const myIdx = isMultiplayer
          ? mpPlayers.findIndex((p) => p.id === getPlayerId())
          : 0;
        return (
          <GiftPopup
            open={showGift}
            onClose={() => setShowGift(false)}
            players={players.map((p, i) => ({ ...p, index: i, name: getPlayerName(i) }))}
            senderIndex={myIdx}
            onGiftSent={({ from, to, gift }) => {
              const start = document.querySelector(`[data-player-index="${from}"]`);
              const end = document.querySelector(`[data-player-index="${to}"]`);
              if (start && end) {
                const s = start.getBoundingClientRect();
                const e = end.getBoundingClientRect();
                const cx = window.innerWidth / 2;
                const cy = window.innerHeight / 2;
                let icon;
                if (typeof gift.icon === 'string' && gift.icon.match(/\.(png|jpg|jpeg|webp|svg)$/)) {
                  icon = document.createElement('img');
                  icon.src = gift.icon;
                  icon.className = 'w-6 h-6';
                } else {
                  icon = document.createElement('div');
                  icon.textContent = gift.icon;
                  icon.style.fontSize = '24px';
                }
                icon.style.position = 'fixed';
                icon.style.left = '0px';
                icon.style.top = '0px';
                icon.style.pointerEvents = 'none';
                icon.style.transform = `translate(${s.left + s.width / 2}px, ${s.top + s.height / 2}px) scale(1)`;
                icon.style.zIndex = '9999';
                document.body.appendChild(icon);
                const giftSound = giftSounds[gift.id];
                if (gift.id === 'laugh_bomb' && !muted) {
                  bombSoundRef.current.currentTime = 0;
                  bombSoundRef.current.play().catch(() => {});
                  hahaSoundRef.current.currentTime = 0;
                  hahaSoundRef.current.play().catch(() => {});
                  setTimeout(() => {
                    hahaSoundRef.current.pause();
                  }, 5000);
                } else if (gift.id === 'coffee_boost' && !muted) {
                  const a = new Audio(giftSound);
                  a.volume = getGameVolume();
                  a.currentTime = 4;
                  a.play().catch(() => {});
                  setTimeout(() => {
                    a.pause();
                  }, 4000);
                } else if (gift.id === 'baby_chick' && !muted) {
                  const a = new Audio(giftSound);
                  a.volume = getGameVolume();
                  a.play().catch(() => {});
                } else if (gift.id === 'magic_trick' && !muted) {
                  const a = new Audio(giftSound);
                  a.volume = getGameVolume();
                  a.play().catch(() => {});
                  setTimeout(() => {
                    a.pause();
                  }, 4000);
                } else if (gift.id === 'fireworks' && !muted) {
                  const a = new Audio(giftSound);
                  a.volume = getGameVolume();
                  a.play().catch(() => {});
                  setTimeout(() => {
                    a.pause();
                  }, 6000);
                } else if (gift.id === 'surprise_box' && !muted) {
                  const a = new Audio(giftSound);
                  a.volume = getGameVolume();
                  a.play().catch(() => {});
                  setTimeout(() => {
                    a.pause();
                  }, 5000);
                } else if (gift.id === 'bullseye' && !muted) {
                  const a = new Audio(giftSound);
                  a.volume = getGameVolume();
                  setTimeout(() => {
                    a.play().catch(() => {});
                  }, 2500);
                } else if (giftSound) {
                  const a = new Audio(giftSound);
                  a.volume = getGameVolume();
                  a.play().catch(() => {});
                }
                const animation = icon.animate(
                  [
                    { transform: `translate(${s.left + s.width / 2}px, ${s.top + s.height / 2}px) scale(1)` },
                    { transform: `translate(${cx}px, ${cy}px) scale(3)`, offset: 0.5 },
                    { transform: `translate(${e.left + e.width / 2}px, ${e.top + e.height / 2}px) scale(1)` },
                  ],
                  // Slow down gift animation to roughly 3.5 seconds
                  { duration: 3500, easing: 'linear' },
                );
                animation.onfinish = () => icon.remove();
              }
            }}
          />
        );
      })()}
      {waitingForPlayers && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70">
          <p className="text-white text-lg">
            Waiting for {playersNeeded} more player{playersNeeded === 1 ? '' : 's'}...
          </p>
        </div>
      )}
      {rollResult !== null && (
        <div className="fixed bottom-52 inset-x-0 flex justify-center z-30 pointer-events-none">
          <div
            className="text-7xl roll-result"
            // Move the number slightly higher so it's clearer on small screens
            // and still shifted right so it doesn't overlap the dice image
            style={{ color: rollColor, transform: 'translate(1rem, -6rem)' }}
          >
            {rollResult}
          </div>
        </div>
      )}
      {rewardDice > 0 && (
        <div className="fixed bottom-40 inset-x-0 flex justify-center z-30 pointer-events-none reward-dice-container">
          {Array.from({ length: rewardDice }).map((_, i) => (
            <img key={i}  src="/assets/icons/file_000000009160620a96f728f463de1c3f.webp" className="reward-dice" />
          ))}
        </div>
      )}
      {!isMultiplayer && (
        <div ref={diceRef} style={diceStyle} className="dice-travel flex flex-col items-center relative">
          {showTrail && (
            <img
              src="/assets/icons/throwing_hand_down.webp"
              alt=""
              className="dice-trail-img"
            />
          )}
          <div className="scale-90">
            <DiceRoller
              divRef={diceRollerDivRef}
              onRollEnd={(vals) => {
                if (aiRollingIndex) {
                  handleAIRoll(aiRollingIndex, vals);
                  setAiRollingIndex(null);
                } else {
                handleRoll(vals);
                setBonusDice(0);
              }
              setRollingIndex(null);
              setPlayerAutoRolling(false);
            }}
            onRollStart={() => {
                if (timerRef.current) clearInterval(timerRef.current);
                timerSoundRef.current?.pause();
                setRollingIndex(aiRollingIndex || 0);
                const idx = aiRollingIndex != null ? aiRollingIndex : 0;
                prepareDiceAnimation(idx);
                animateDiceToCenter(idx);
                setShowTrail(true);
                clearTimeout(trailTimeoutRef.current);
                trailTimeoutRef.current = setTimeout(
                  () => setShowTrail(false),
                  DICE_ANIM_DURATION,
                );
                if (aiRollingIndex)
                  return setTurnMessage(<>{playerName(aiRollingIndex)} rolling...</>);
                if (playerAutoRolling) return setTurnMessage('Rolling...');
                return setTurnMessage("Rolling...");
              }
            }
            clickable={
              !aiRollingIndex &&
              !playerAutoRolling &&
              rollCooldown === 0 &&
              currentTurn === 0 &&
              !moving
            }
            numDice={diceCount + bonusDice}
            trigger={aiRollingIndex != null ? aiRollTrigger : playerAutoRolling ? playerRollTrigger : undefined}
            showButton={false}
            muted={muted}
          />
          </div>
        </div>
      )}
      {currentTurn === 0 && !aiRollingIndex && !playerAutoRolling && (
        <div
          className="fixed bottom-24 inset-x-0 flex flex-col items-center z-20 cursor-pointer"
          style={{ transform: 'translateX(2rem)' }}
          onClick={() => diceRollerDivRef.current?.click()}
        >
          <div className="text-5xl">🫵</div>
          <div
            className="turn-message text-2xl mt-1"
            style={{ color: players[currentTurn]?.color }}
          >
            Your turn
          </div>
        </div>
      )}
      {isMultiplayer && (
        <div
          className="fixed bottom-24 inset-x-0 flex flex-col items-center z-20 cursor-pointer"
          style={{ transform: 'translateX(2rem)' }}
          onClick={() => diceRollerDivRef.current?.click()}
        >
          <div className="scale-90">
          {(() => {
            const myId = getPlayerId();
            const myIndex = mpPlayers.findIndex(p => p.id === myId);
            if (currentTurn === myIndex && !moving) {
              return (
                <DiceRoller
                  clickable
                  showButton={false}
                  muted={muted}
                  emitRollEvent
                  divRef={diceRollerDivRef}
                />
              );
            }
            return null;
          })()}
          </div>
        </div>
      )}
      {!watchOnly && (
      <InfoPopup
        open={showQuitInfo}
        onClose={() => setShowQuitInfo(false)}
        title="Warning"
        info="If you quit the game your funds will be lost and you will be placed last."
        widthClass="w-80"
      />
      )}
      {!watchOnly && (
      <InfoPopup
        open={showInfo}
        onClose={() => setShowInfo(false)}
        title="Snake & Ladder"
        info="Roll two dice each turn. Move forward by their sum. Ladders lift you up and snakes bring you down. You must land exactly on the pot tile to win."
      />
      )}
      {!watchOnly && (
      <HintPopup
        open={showExactHelp}
        onClose={() => setShowExactHelp(false)}
        message="You must roll the exact number to land on the pot."
      />
      )}
      {!watchOnly && (
      <InfoPopup
        open={connectionLost}
        onClose={() => setConnectionLost(false)}
        title="Connection Lost"
        info="Attempting to reconnect..."
      />
      )}
      {!watchOnly && (
      <InfoPopup
        open={forfeitMsg}
        onClose={() => setForfeitMsg(false)}
        title="Disconnected"
        info="You were disconnected too long and forfeited the match."
      />
      )}
      {!watchOnly && (
      <InfoPopup
        open={!!disconnectMsg}
        onClose={() => setDisconnectMsg(null)}
        title="Player Update"
        info={disconnectMsg}
      />
      )}
      {!watchOnly && (
      <InfoPopup
        open={!!cheatMsg}
        onClose={() => setCheatMsg(null)}
        title="Warning"
        info={cheatMsg}
      />
      )}
      {!watchOnly && (
      <InfoPopup
        open={!!leftWinner}
        onClose={() => setLeftWinner(null)}
        title="Opponent Left"
        info={
          leftWinner && (
            <span>
              {leftWinner} left the game. You win {Math.round(pot * 2 * 0.91)}{' '}
              <img
                src={
                  token === 'TON'
                    ? '/assets/icons/TON.webp'
                    : token === 'USDT'
                    ? '/assets/icons/Usdt.webp'
                    : '/assets/icons/TPCcoin_1.webp'
                }
                alt={token}
                className="inline w-4 h-4 align-middle"
              />
            </span>
          )
        }
      >
        <div className="flex justify-center mt-2">
          <button
            onClick={() => navigate('/games/snake/lobby')}
            className="lobby-tile px-4 py-1"
          >
            Return to Lobby
          </button>
        </div>
      </InfoPopup>
      )}
      {watchOnly && (
      <InfoPopup
        open={showWatchWelcome}
        onClose={() => setShowWatchWelcome(false)}
        title="Watching Game"
        info="You're watching this match. Support your player by sending NFT GIFs and chat messages. Watching is free, but each chat costs 10 TPC."
      />
      )}
      <InfoPopup
        open={!!boardError}
        onClose={() => setBoardError(null)}
        title="Error"
        info={boardError}
      >
        <div className="flex justify-center mt-2">
          <button
            onClick={() => window.location.reload()}
            className="lobby-tile px-4 py-1"
          >
            Retry
          </button>
        </div>
      </InfoPopup>
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
      {!watchOnly && (
      <ConfirmPopup
        open={showLobbyConfirm}
        message="Quit the game? If you leave, your funds will be lost and you'll be placed last."
        onConfirm={() => {
          localStorage.removeItem(`snakeGameState_${ai}`);
          navigate("/games/snake/lobby");
        }}
        onCancel={() => setShowLobbyConfirm(false)}
      />
      )}
    </div>
  );
}
