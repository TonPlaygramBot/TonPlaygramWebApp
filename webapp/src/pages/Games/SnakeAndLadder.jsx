import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import coinConfetti from "../../utils/coinConfetti";
import DiceRoller from "../../components/DiceRoller.jsx";
import SnakeBoard3D from "../../components/SnakeBoard3D.jsx";
import { FINAL_TILE as BOARD_FINAL_TILE } from "../../components/SnakeBoard.jsx";
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
import { FLAG_EMOJIS } from "../../utils/flagEmojis.js";
import { getAvatarUrl, saveAvatar, loadAvatar, avatarToName } from "../../utils/avatarUtils.js";
import InfoPopup from "../../components/InfoPopup.jsx";
import HintPopup from "../../components/HintPopup.jsx";
import GameEndPopup from "../../components/GameEndPopup.jsx";
import {
  AiOutlineRollback,
  AiOutlineReload,
} from "react-icons/ai";
import BottomLeftIcons from "../../components/BottomLeftIcons.jsx";
import { isGameMuted, getGameVolume, setGameMuted } from "../../utils/sound.js";
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
const FINAL_TILE = BOARD_FINAL_TILE;
const TURN_TIME = 15;
const DEFAULT_CAPACITY = 4;
const SEAT_LAYOUTS = {
  1: [0],
  2: [0, 2],
  3: [0, 1, 3],
  4: [0, 1, 2, 3]
};

const resolveSeatLayout = (count) => {
  const clamped = Math.max(1, Math.min(count, DEFAULT_CAPACITY));
  return SEAT_LAYOUTS[clamped] || SEAT_LAYOUTS[DEFAULT_CAPACITY];
};

const computeSeatAssignments = (players, selfId) => {
  if (!Array.isArray(players) || players.length === 0) return new Map();
  const layout = resolveSeatLayout(players.length);
  const seats = layout.slice(0, players.length);
  while (seats.length < players.length) {
    const last = seats[seats.length - 1] ?? seats.length - 1;
    seats.push(last + 1);
  }
  const order = [];
  const selfIndex = selfId ? players.findIndex((p) => p.id === selfId) : -1;
  if (selfIndex >= 0) order.push(selfIndex);
  players.forEach((_, index) => {
    if (index !== selfIndex) order.push(index);
  });
  const assignments = new Map();
  order.forEach((playerIndex, orderIndex) => {
    const seatIndex = seats[orderIndex] ?? seats[seats.length - 1] ?? orderIndex;
    assignments.set(playerIndex, seatIndex);
  });
  players.forEach((_, index) => {
    if (!assignments.has(index)) {
      const seatIndex = seats[index] ?? seats[seats.length - 1] ?? index;
      assignments.set(index, seatIndex);
    }
  });
  return assignments;
};

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const FALLBACK_SEAT_POSITIONS = [
  { left: '50%', top: '82%' },
  { left: '78%', top: '54%' },
  { left: '48%', top: '22%' },
  { left: '22%', top: '55%' }
];

const clampValue = (value, min, max) => Math.max(min, Math.min(max, value));

function parseHexColor(hex) {
  if (typeof hex !== 'string') return null;
  const trimmed = hex.trim();
  const match = trimmed.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  let value = match[1];
  if (value.length === 3) {
    value = value.split('').map((ch) => ch + ch).join('');
  }
  const intVal = parseInt(value, 16);
  return [
    (intVal >> 16) & 255,
    (intVal >> 8) & 255,
    intVal & 255
  ];
}

function mixHexColor(base, target, amount) {
  const from = parseHexColor(base);
  const to = parseHexColor(target);
  if (!from || !to) return base;
  const ratio = clampValue(amount, 0, 1);
  const mixed = from.map((component, idx) =>
    Math.round(component + (to[idx] - component) * ratio)
  );
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const lightenHex = (hex, amount = 0.25) => mixHexColor(hex, '#ffffff', amount);
const darkenHex = (hex, amount = 0.25) => mixHexColor(hex, '#000000', amount);

function generateBoardLocal() {
  const boardSize = FINAL_TILE - 1;
  const snakeCount = 6 + Math.floor(Math.random() * 3);
  const ladderCount = 6 + Math.floor(Math.random() * 3);
  const snakes = {};
  const used = new Set();
  while (Object.keys(snakes).length < snakeCount) {
    const start = Math.floor(Math.random() * (boardSize - 10)) + 10;
    const maxDrop = Math.min(start - 1, 20);
    if (maxDrop <= 0) continue;
    const end = start - (Math.floor(Math.random() * maxDrop) + 1);
    if (used.has(start) || used.has(end) || snakes[start] || end === 1) continue;
    snakes[start] = end;
    used.add(start);
    used.add(end);
  }
  const ladders = {};
  const usedL = new Set([...used]);
  while (Object.keys(ladders).length < ladderCount) {
    const start = Math.floor(Math.random() * (boardSize - 20)) + 2;
    const max = Math.min(boardSize - start - 1, 20);
    if (max < 1) continue;
    const end = start + (Math.floor(Math.random() * max) + 1);
    if (
      usedL.has(start) ||
      usedL.has(end) ||
      ladders[start] ||
      Object.values(ladders).includes(end)
    )
      continue;
    ladders[start] = end;
    usedL.add(start);
    usedL.add(end);
  }
  const diceCells = generateDiceCellsLocal(snakes, ladders);
  return { snakes, ladders, diceCells };
}

function normalizeDiceCells(cells = {}) {
  const normalized = {};
  Object.entries(cells).forEach(([key, value]) => {
    const cell = Number(key);
    const val = Number(value);
    if (Number.isFinite(cell) && Number.isFinite(val)) normalized[cell] = val;
  });
  return normalized;
}

function generateDiceCellsLocal(snakes = {}, ladders = {}) {
  const boardSize = FINAL_TILE - 1;
  const diceValues = [1, 2, 1];
  const diceCells = {};
  const used = new Set([
    ...Object.keys(snakes),
    ...Object.values(snakes),
    ...Object.keys(ladders),
    ...Object.values(ladders)
  ].map((v) => Number(v)));

  const isBlocked = (cell) =>
    used.has(cell) || diceCells[cell] != null || cell <= 1 || cell >= FINAL_TILE;

  diceValues.forEach((value) => {
    let attempts = 0;
    let cell;
    do {
      cell = Math.floor(Math.random() * boardSize) + 1;
      attempts += 1;
      if (attempts > boardSize * 3) return;
    } while (isBlocked(cell));
    diceCells[cell] = value;
    used.add(cell);
  });

  return diceCells;
}

export default function SnakeAndLadder() {
  const [showLobbyConfirm, setShowLobbyConfirm] = useState(false);
  const [showQuitInfo, setShowQuitInfo] = useState(true);
  useTelegramBackButton(() => setShowLobbyConfirm(true));
  const navigate = useNavigate();

  const [accountId, setAccountId] = useState(() => getPlayerId());
  const [tableCapacity, setTableCapacity] = useState(DEFAULT_CAPACITY);
  const tableCapacityRef = useRef(DEFAULT_CAPACITY);

  useEffect(() => {
    ensureAccountId()
      .then((id) => {
        if (id) setAccountId(id);
      })
      .catch(() => {});
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
    const id = accountId || getPlayerId();
    if (!id) return undefined;
    function ping() {
      const status = localStorage.getItem('onlineStatus') || 'online';
      pingOnline(id, status).catch(() => {});
    }
    ping();
    const t = setInterval(ping, 30000);
    return () => clearInterval(t);
  }, [accountId]);

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
  const [showConfig, setShowConfig] = useState(false);
  const [showTrailEnabled, setShowTrailEnabled] = useState(true);
  const [snakes, setSnakes] = useState({});
  const [ladders, setLadders] = useState({});
  const [snakeOffsets, setSnakeOffsets] = useState({});
  const [ladderOffsets, setLadderOffsets] = useState({});
  const [offsetPopup, setOffsetPopup] = useState(null); // { cell, type, amount }
  const [, setRollResult] = useState(null);
  const [diceCells, setDiceCells] = useState({});
  const [bonusDice, setBonusDice] = useState(0);
  const [rewardDice, setRewardDice] = useState(0);
  const [diceCount, setDiceCount] = useState(2);
  const [playerDiceCounts, setPlayerDiceCounts] = useState([2]);
  const [gameOver, setGameOver] = useState(false);
  const [ai, setAi] = useState(0);
  const [aiPositions, setAiPositions] = useState([]);
  const [playerColors, setPlayerColors] = useState([]);
  const [, setRollColor] = useState('#fff');
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
  const refreshPlayersNeeded = useCallback(
    (playersList = playersRef.current, capacityValue) => {
      const cap = Number.isFinite(capacityValue) && capacityValue > 0 ? capacityValue : tableCapacityRef.current;
      const list = Array.isArray(playersList) ? playersList : playersRef.current;
      const count = list.length;
      setPlayersNeeded(Math.max(0, cap - count));
    },
    []
  );
  const updateMpPlayers = useCallback(
    (updater, capacityValue) => {
      setMpPlayers((prev) => {
        const base = Array.isArray(prev) ? prev : [];
        const next = typeof updater === 'function' ? updater(base) : updater;
        if (!Array.isArray(next)) {
          playersRef.current = base;
          refreshPlayersNeeded(base, capacityValue);
          return base;
        }
        playersRef.current = next;
        refreshPlayersNeeded(next, capacityValue);
        return next;
      });
    },
    [refreshPlayersNeeded]
  );
  const applyTableCapacity = useCallback(
    (value) => {
      const cap = Number(value);
      if (!Number.isFinite(cap) || cap <= 0) return;
      if (tableCapacityRef.current === cap) {
        refreshPlayersNeeded(playersRef.current, cap);
        return;
      }
      tableCapacityRef.current = cap;
      setTableCapacity(cap);
      refreshPlayersNeeded(playersRef.current, cap);
    },
    [refreshPlayersNeeded]
  );
  const [tableId, setTableId] = useState('snake-4');
  const [playerPopup, setPlayerPopup] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [chatBubbles, setChatBubbles] = useState([]);
  const [showWatchWelcome, setShowWatchWelcome] = useState(false);

  const diceRollerDivRef = useRef(null);
  const slideStateRef = useRef(null);
  const slideIdRef = useRef(0);
  const [slideAnimation, setSlideAnimation] = useState(null);
  const diceRollIdRef = useRef(0);
  const [diceBoardEvent, setDiceBoardEvent] = useState(null);
  const [seatAnchors, setSeatAnchors] = useState([]);
  const [diceAnchor, setDiceAnchor] = useState(null);

  const seatAnchorMap = useMemo(() => {
    const map = new Map();
    seatAnchors.forEach((anchor) => {
      if (anchor && typeof anchor.index === 'number') map.set(anchor.index, anchor);
    });
    return map;
  }, [seatAnchors]);

  const diceAnchorStyle = useMemo(() => {
    if (diceAnchor && Number.isFinite(diceAnchor.x) && Number.isFinite(diceAnchor.y)) {
      return {
        position: 'absolute',
        left: `${diceAnchor.x}%`,
        top: `${diceAnchor.y}%`,
        transform: 'translate(-50%, -50%)'
      };
    }
    return {
      position: 'absolute',
      left: '50%',
      top: '74%',
      transform: 'translate(-50%, -50%)'
    };
  }, [diceAnchor]);

  const diceAnchorScale = useMemo(() => {
    if (!diceAnchor || !Number.isFinite(diceAnchor.depth)) return 1;
    return clampValue(1.25 - (diceAnchor.depth - 2.5) * 0.22, 0.85, 1.18);
  }, [diceAnchor]);

  const requestSlideAnimation = useCallback(
    ({ playerIndex, from, to, type, onComplete }) => {
      if (slideStateRef.current) return false;
      slideIdRef.current += 1;
      const payload = {
        id: slideIdRef.current,
        playerIndex,
        from,
        to,
        type,
        onComplete
      };
      slideStateRef.current = payload;
      setSlideAnimation(payload);
      return true;
    },
    []
  );

  const handleSlideComplete = useCallback((id) => {
    setSlideAnimation((current) => {
      if (!current || current.id !== id) return current;
      const finalize = current.onComplete;
      slideStateRef.current = null;
      if (typeof finalize === 'function') finalize();
      return null;
    });
  }, []);

  const startDiceBoardAnimation = useCallback((phase) => {
    setDiceBoardEvent(phase);
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
      img.src = '/assets/icons/ezgif-54c96d8a9b9236.webp';
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
      if (!muted) {
        bombSoundRef.current.currentTime = 0;
        bombSoundRef.current.play().catch(() => {});
      }
      if (cell <= 4 && !muted) {
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

  const moveSoundRef = useRef(null);
  const snakeSoundRef = useRef(null);
  const oldSnakeSoundRef = useRef(null);
  const ladderSoundRef = useRef(null);
  const winSoundRef = useRef(null);
  const diceRewardSoundRef = useRef(null);
  const yabbaSoundRef = useRef(null);
  const hahaSoundRef = useRef(null);
  const bombSoundRef = useRef(null);
  const badLuckSoundRef = useRef(null);
  const cheerSoundRef = useRef(null);
  const timerSoundRef = useRef(null);
  const timerRef = useRef(null);
  const aiRollTimeoutRef = useRef(null);
  const reloadingRef = useRef(false);
  const turnEndRef = useRef(Date.now() + TURN_TIME * 1000);
  const aiRollTimeRef = useRef(null);
  const prevTimeLeftRef = useRef(TURN_TIME);

  const getPreviousTurn = useCallback(
    (turn) => {
      const totalPlayers = (ai ?? 0) + 1;
      if (totalPlayers <= 0) return 0;
      return (turn - 1 + totalPlayers) % totalPlayers;
    },
    [ai]
  );

  useEffect(() => {
    const id = accountId || getPlayerId();
    if (!id) return undefined;
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
      badLuckSoundRef.current?.pause();
      cheerSoundRef.current?.pause();
      timerSoundRef.current?.pause();
    };
  }, [accountId]);

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
      badLuckSoundRef,
      cheerSoundRef,
      timerSoundRef,
    ].forEach((r) => {
      if (r.current) r.current.muted = muted;
    });
  }, [muted]);

  useEffect(() => {
    const updatePhoto = () => {
      const id = accountId || getPlayerId();
      if (!id) return;
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
  }, [accountId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const watchParam = params.get("watch");
    const t = params.get("token");
    const amt = params.get("amount");
    const aiParam = params.get("ai");
    const flagsParam = params.get('flags');
    const tableParam = params.get("table");
    const capacityParam = params.get('capacity');
    if (t) setToken(t.toUpperCase());
    if (amt) setPot(Number(amt));
    const aiCount = aiParam
      ? Math.max(1, Math.min(3, Number(aiParam)))
      : tableParam
        ? 0
        : 1;
    setAi(aiCount);
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
    if (flagsParam) {
      const indices = flagsParam
        .split(',')
        .map((n) => parseInt(n))
        .filter((i) => i >= 0 && i < FLAG_EMOJIS.length);
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
    const colors = shuffle(TOKEN_COLORS).slice(0, aiCount + 1).map(c => c.color);
    setPlayerColors(colors);

    const storedTable = localStorage.getItem('snakeCurrentTable');
    const table = params.get("table") || storedTable || "snake-4";
    setTableId(table);
    localStorage.setItem('snakeCurrentTable', table);
    if (capacityParam) {
      applyTableCapacity(Number(capacityParam));
    } else if (table) {
      const parts = table.split('-');
      if (parts.length > 1) {
        const parsedCap = parseInt(parts[1], 10);
        if (Number.isFinite(parsedCap) && parsedCap >= 1 && parsedCap <= DEFAULT_CAPACITY) {
          applyTableCapacity(parsedCap);
        }
      }
    }
    const boardPromise = isMultiplayer
      ? getSnakeBoard(table)
      : Promise.resolve(generateBoardLocal());
    boardPromise
      .then(({ snakes: snakesObj = {}, ladders: laddersObj = {}, diceCells: diceCellsObj = {} }) => {
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
        const normalizedDice = normalizeDiceCells(diceCellsObj);
        const diceSource = Object.keys(normalizedDice).length
          ? normalizedDice
          : generateDiceCellsLocal(snakesObj, laddersObj);
        setDiceCells(diceSource);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    tableCapacityRef.current = tableCapacity;
    if (isMultiplayer) {
      refreshPlayersNeeded(playersRef.current, tableCapacity);
    }
  }, [tableCapacity, isMultiplayer, refreshPlayersNeeded]);

  useEffect(() => {
    if (isMultiplayer) {
      localStorage.setItem('snakeCurrentTable', tableId);
    } else {
      localStorage.removeItem('snakeCurrentTable');
    }
  }, [isMultiplayer, tableId]);

  useEffect(() => {
    if (!isMultiplayer || watchOnly) return;
    if (!setupPhase) {
      setWaitingForPlayers(false);
      return;
    }
    setWaitingForPlayers(playersNeeded > 0);
  }, [isMultiplayer, playersNeeded, setupPhase, watchOnly]);

  useEffect(() => {
    if (!isMultiplayer) return;
    const myAccountId = accountId || getPlayerId();
    const name = myName;
    const initialCapacity = tableCapacityRef.current;
    if (!watchOnly) {
      setWaitingForPlayers(true);
      refreshPlayersNeeded(playersRef.current, initialCapacity);
    } else {
      setWaitingForPlayers(false);
    }

    const handleCapacity = (value) => {
      if (Number.isFinite(value) && value > 0) {
        applyTableCapacity(value);
      }
    };

    const onJoined = ({ playerId, name: joinedName, avatar, maxPlayers }) => {
      handleCapacity(maxPlayers);
      const name = joinedName || `Player`;
      const photoUrl = avatar || '/assets/icons/profile.svg';
      updateMpPlayers((p) => {
        if (p.some((pl) => pl.id === playerId)) {
          return p;
        }
        return [...p, { id: playerId, name, photoUrl, position: 0 }];
      }, maxPlayers);
    };
    const onLeft = ({ playerId, maxPlayers }) => {
      handleCapacity(maxPlayers);
      updateMpPlayers((p) => {
        const leaving = p.find((pl) => pl.id === playerId);
        const arr = p.filter((pl) => pl.id !== playerId);
        if (leaving && !ranking.some((r) => r.name === leaving.name)) {
          setRanking((r) => [...r, { name: leaving.name, photoUrl: leaving.photoUrl, amount: 0 }]);
        }
        if (leaving) {
          if (playerId === myAccountId) {
            setForfeitMsg(true);
          } else if (arr.length === 1 && tableCapacityRef.current === 2) {
            setLeftWinner(leaving.name);
          } else if (tableCapacityRef.current > 2) {
            setDisconnectMsg(`${leaving.name} forfeited`);
            setTimeout(() => setDisconnectMsg(null), 3000);
          }
        }
        return arr;
      }, maxPlayers);
    };
    const onMove = ({ playerId, from = 0, to }) => {
      const updatePosition = (pos) => {
        updateMpPlayers((p) => p.map((pl) => (pl.id === playerId ? { ...pl, position: pos } : pl)));
        if (playerId === myAccountId) setPos(pos);
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
        updateMpPlayers((p) => p.map((pl) => (pl.id === playerId ? { ...pl, position: pos } : pl)));
        if (playerId === myAccountId) setPos(pos);
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
        updateMpPlayers((p) => p.map((pl) => (pl.id === playerId ? { ...pl, position: 0 } : pl)));
        if (playerId === myAccountId) setPos(0);
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
      setSetupPhase(false);
      setWaitingForPlayers(false);
      if (myAccountId) {
        unseatTable(myAccountId, tableId).catch(() => {});
      }
    };
    const onRolled = ({ value }) => {
      setRollResult(value);
      setTimeout(() => setRollResult(null), 2000);
    };
    const onWon = ({ playerId }) => {
      setGameOver(true);
      const winnerName = playerId === myAccountId ? myName : playerId;
      const winnerPhoto =
        playerId === myAccountId
          ? photoUrl
          : mpPlayers.find((p) => p.id === playerId)?.photoUrl || '';
      setRanking((r) => {
        const others = r.filter((p) => p.name !== winnerName);
        return [{ name: winnerName, photoUrl: winnerPhoto, amount: 0 }, ...others];
      });
      if (playerId === myAccountId) {
        const totalPlayers = isMultiplayer ? mpPlayers.length : ai + 1;
        const tgId = getTelegramId();
        if (token === 'TPC' && pot > 0) {
          const total = pot * totalPlayers;
          ensureAccountId()
            .then(async (aid) => {
              const winAmt = Math.round(total * 0.91);
              if (tgId) {
                await Promise.all([
                  depositAccount(aid, winAmt, { game: 'snake-win' }),
                  awardDevShare(total)
                ]);
              } else {
                await Promise.all([
                  addTransaction(null, winAmt, 'deposit', {
                    game: 'snake-win',
                    accountId: aid
                  }),
                  awardDevShare(total)
                ]);
              }
              addTransaction(tgId, 0, 'win', {
                game: 'snake',
                players: totalPlayers,
                accountId: aid
              });
            })
            .catch(() => {});
        } else {
          addTransaction(tgId, 0, 'win', {
            game: 'snake',
            players: totalPlayers,
            accountId: myAccountId
          });
        }
      }
    };

    const onCurrentPlayers = (payload) => {
      const list = Array.isArray(payload) ? payload : payload?.players;
      const capValue = Array.isArray(payload) ? undefined : payload?.maxPlayers ?? payload?.capacity;
      handleCapacity(capValue);
      if (!Array.isArray(list)) return;
      const arr = list.map((p) => ({
        id: p.playerId ?? p.id,
        name: p.name || `Player`,
        photoUrl: p.avatar || p.photoUrl || '/assets/icons/profile.svg',
        position: p.position || 0
      }));
      updateMpPlayers(arr, capValue);
    };

    socket.on('playerJoined', onJoined);
    socket.on('playerLeft', onLeft);
    socket.on('playerDisconnected', ({ playerId, maxPlayers }) => {
      handleCapacity(maxPlayers);
      if (playerId === myAccountId) {
        setConnectionLost(true);
      } else if (tableCapacityRef.current > 2) {
        const name = playersRef.current.find((p) => p.id === playerId)?.name || playerId;
        setDisconnectMsg(`${name} disconnected`);
        setTimeout(() => setDisconnectMsg(null), 3000);
      }
    });
    socket.on('playerRejoined', ({ playerId, maxPlayers }) => {
      handleCapacity(maxPlayers);
      if (playerId === myAccountId) {
        setConnectionLost(false);
      } else if (tableCapacityRef.current > 2) {
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
    socket.on('turnUpdate', ({ currentTurn }) => onTurn({ playerId: currentTurn }));
    socket.on('lobbyUpdate', ({ players: list, maxPlayers }) => {
      handleCapacity(maxPlayers);
      if (!Array.isArray(list)) return;
      const arr = list.map((p) => ({
        id: p.id,
        name: p.name,
        photoUrl: p.avatar || '/assets/icons/profile.svg',
        position: p.position || 0
      }));
      updateMpPlayers(arr, maxPlayers);
    });
    socket.on('gameStart', onStarted);
    socket.on('gameStarted', onStarted);
    socket.on('diceRolled', onRolled);
    socket.on('gameWon', onWon);
    socket.on('currentPlayers', onCurrentPlayers);
    socket.on('boardData', ({ snakes: sn, ladders: lad, diceCells: diceObj }) => {
      const limit = (obj) => Object.fromEntries(Object.entries(obj).slice(0, 8));
      const snakesLim = limit(sn || {});
      const laddersLim = limit(lad || {});
      setSnakes(snakesLim);
      setLadders(laddersLim);
      const snk = {};
      Object.entries(snakesLim).forEach(([s, e]) => {
        snk[s] = s - e;
      });
      const ladOff = {};
      Object.entries(laddersLim).forEach(([s, e]) => {
        const end = typeof e === 'object' ? e.end : e;
        ladOff[s] = end - s;
      });
      setSnakeOffsets(snk);
      setLadderOffsets(ladOff);
      if (diceObj) {
        setDiceCells(normalizeDiceCells(diceObj));
      }
    });
    socket.on('diceCellsUpdate', ({ diceCells: updated }) => {
      setDiceCells(normalizeDiceCells(updated || {}));
    });

    if (watchOnly) {
      socket.emit('watchRoom', { roomId: tableId });
      getSnakeLobby(tableId)
        .then((data) => {
          const players = data.players || [];
          const capacityHint = data?.maxPlayers ?? data?.capacity;
          handleCapacity(capacityHint);
          return Promise.all(
            players.map(async (p) => {
              const prof = await getProfileByAccount(p.id).catch(() => ({}));
              const n =
                prof?.nickname || `${prof?.firstName || ''} ${prof?.lastName || ''}`.trim() || p.name;
              const photoUrl = prof?.photo || '/assets/icons/profile.svg';
              return { id: p.id, name: n, photoUrl, position: 0 };
            })
          ).then((arr) => {
            updateMpPlayers(arr, capacityHint);
          });
        })
        .catch(() => {});
    } else {
      socket.emit('joinRoom', { roomId: tableId, playerId: myAccountId, name, avatar: photoUrl });
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
      socket.off('turnUpdate');
      socket.off('lobbyUpdate');
      socket.off('gameStart', onStarted);
      socket.off('gameStarted', onStarted);
      socket.off('diceRolled', onRolled);
      socket.off('gameWon', onWon);
      socket.off('currentPlayers', onCurrentPlayers);
      socket.off('boardData');
      socket.off('diceCellsUpdate');
      if (watchOnly) {
        socket.emit('leaveWatch', { roomId: tableId });
      } else {
        if (myAccountId) {
          unseatTable(myAccountId, tableId).catch(() => {});
        }
      }
    };
  }, [accountId, applyTableCapacity, isMultiplayer, myName, photoUrl, refreshPlayersNeeded, tableId, updateMpPlayers, watchOnly]);

  const fastForward = (elapsed, state) => {
    let p = state.pos ?? 0;
    let aiPos = [...(state.aiPositions ?? Array(ai).fill(0))];
    let turn = state.currentTurn ?? 0;
    let rank = [...(state.ranking ?? [])].map((r) =>
      typeof r === 'string' ? { name: r, photoUrl: '', amount: 0 } : r,
    );
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
        if (p === FINAL_TILE && !rank.some((r) => r.name === 'You')) {
          rank.push({ name: 'You', photoUrl: '', amount: 0 });
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
        if (pos === FINAL_TILE && !rank.some((r) => r.name === getPlayerName(turn))) {
          rank.push({ name: getPlayerName(turn), photoUrl: getPlayerAvatar(turn), amount: 0 });
          if (rank.length === 1) over = true;
        }
      }
      turn = getPreviousTurn(turn);
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
          setRanking((data.ranking || []).map((r) =>
            typeof r === 'string'
              ? { name: r, photoUrl: '', amount: 0 }
              : r,
          ));
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
          const next = getPreviousTurn(currentTurn);
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
          const next = getPreviousTurn(currentTurn);
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
        const next = getPreviousTurn(currentTurn);
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
      const nextPlayer = extraPred ? currentTurn : getPreviousTurn(currentTurn);

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
        playerIndex: 0,
        startSlide: ({ from, to, type, onComplete }) =>
          requestSlideAnimation({
            playerIndex: 0,
            from,
            to,
            type,
            onComplete
          })
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
        if (finalPos === FINAL_TILE && !ranking.some((r) => r.name === 'You')) {
          const first = ranking.length === 0;
          const total = pot * (ai + 1);
          const winAmt = Math.round(total * 0.91);
          if (first) {
            ensureAccountId()
              .then(async (aid) => {
                await Promise.all([
                  depositAccount(aid, winAmt, { game: 'snake-win' }),
                  awardDevShare(total),
                ]);
              })
              .catch(() => {});
          }
          setRanking((r) => [...r, { name: 'You', photoUrl, amount: winAmt }]);
          if (first) setGameOver(true);
          setMessage(`You win ${winAmt} ${token}!`);
          setMessageColor("");
          if (!muted) winSoundRef.current?.play().catch(() => {});
          coinConfetti();
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
          const next = extraTurn ? currentTurn : getPreviousTurn(currentTurn);
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
        const next = getPreviousTurn(currentTurn);
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
        const next = getPreviousTurn(currentTurn);
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
    const nextPlayer = extraPred ? index : getPreviousTurn(index);

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
      playerIndex: index,
      startSlide: ({ from, to, type, onComplete }) =>
        requestSlideAnimation({
          playerIndex: index,
          from,
          to,
          type,
          onComplete
        })
    };

    const finalizeMove = async (finalPos, type) => {
      positions[index - 1] = finalPos;
      setAiPositions([...positions]);
      setHighlight({ cell: finalPos, type });
      setTrail([]);
      capturePieces(finalPos, index);
      setTimeout(() => setHighlight(null), 2300);
      if (finalPos === FINAL_TILE && !ranking.some((r) => r.name === getPlayerName(index))) {
        const first = ranking.length === 0;
        const name = getPlayerName(index);
        const avatar = getPlayerAvatar(index);
        const winAmt = Math.round(pot * (ai + 1) * 0.91);
        setRanking((r) => [...r, { name, photoUrl: avatar, amount: first ? winAmt : 0 }]);
        if (first) {
          await awardDevShare(pot * (ai + 1));
          setGameOver(true);
        }
        setMessage(`${name} wins!`);
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
      const next = extraTurn ? index : getPreviousTurn(index);
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
    if (waitingForPlayers || !setupPhase || aiPositions.length !== ai) return;
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
  }, [ai, aiPositions, setupPhase]);


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
      ? mpPlayers.findIndex((p) => p.id === accountId)
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



  const seatAssignments = useMemo(
    () => (isMultiplayer ? computeSeatAssignments(mpPlayers, accountId) : new Map()),
    [isMultiplayer, mpPlayers, accountId]
  );

  const players = isMultiplayer
    ? mpPlayers.map((p, i) => ({
        id: p.id,
        position: p.position,
        photoUrl: p.photoUrl || '/assets/icons/profile.svg',
        type: 'normal',
        color: playerColors[i] || '#fff',
        seatIndex: seatAssignments.get(i)
      }))
    : [
        { position: pos, photoUrl, type: tokenType, color: playerColors[0], seatIndex: 0 },
        ...aiPositions.map((p, i) => ({
          position: p,
          photoUrl: aiAvatars[i] || '/assets/icons/profile.svg',
          type: 'normal',
          color: playerColors[i + 1],
          seatIndex: i + 1
        }))
      ];

  const computedIndex = isMultiplayer
    ? mpPlayers.findIndex((p) => p.id === accountId)
    : 0;
  const myPlayerIndex = computedIndex >= 0 ? computedIndex : null;
  const canRoll =
    myPlayerIndex !== null &&
    currentTurn === myPlayerIndex &&
    !moving &&
    rollCooldown === 0 &&
    !gameOver &&
    !waitingForPlayers &&
    !playerAutoRolling &&
    aiRollingIndex == null &&
    !watchOnly;
  const hasTurnMessage =
    turnMessage !== null &&
    turnMessage !== '' &&
    turnMessage !== false;
  const displayedTurnMessage = hasTurnMessage
    ? turnMessage
    : canRoll
    ? 'Your turn'
    : null;

  const diceRingSize = Math.max(72, Math.round(96 * diceAnchorScale));
  const diceButtonSize = Math.max(60, Math.round(86 * diceAnchorScale));
  const diceVisibilityClass = diceVisible ? 'opacity-100' : 'opacity-0 pointer-events-none';

  const handleRollButtonClick = () => {
    diceRollerDivRef.current?.click();
  };

  // determine ranking numbers based on board positions
  const rankMap = {};
  players
    .map((p, i) => ({ idx: i, pos: p.position }))
    .sort((a, b) => b.pos - a.pos)
    .forEach((p, i) => {
      rankMap[p.idx] = p.pos === 0 ? 0 : i + 1;
    });
  return (
    <div className="relative w-screen h-dvh overflow-hidden bg-[#05070f] text-text select-none">
      <div className="absolute inset-0">
        <SnakeBoard3D
          players={players}
          highlight={highlight}
          trail={showTrailEnabled ? trail : []}
          pot={pot}
          snakes={snakes}
          ladders={ladders}
          snakeOffsets={snakeOffsets}
          ladderOffsets={ladderOffsets}
          offsetPopup={offsetPopup}
          celebrate={celebrate}
          tokenType={tokenType}
          rollingIndex={rollingIndex}
          currentTurn={currentTurn}
          burning={burning}
          slide={slideAnimation}
          onSlideComplete={handleSlideComplete}
          diceEvent={diceBoardEvent}
          onSeatPositionsChange={setSeatAnchors}
          onDiceAnchorChange={setDiceAnchor}
        />
      </div>
      <div className="absolute top-3 right-3 z-30 pointer-events-auto">
        <div className="relative">
          <button
            type="button"
            aria-label={showConfig ? 'Mbyll konfigurimet e lojës' : 'Hap konfigurimet e lojës'}
            onClick={() => setShowConfig((prev) => !prev)}
            className="rounded-full bg-black/70 p-2 text-lg text-gray-100 shadow-lg backdrop-blur transition hover:bg-black/60"
          >
            ⚙️
          </button>
          {showConfig && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-black/85 p-4 text-xs text-gray-100 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-gray-300">
                  Konfigurime
                </span>
                <button
                  type="button"
                  aria-label="Mbyll konfigurimet"
                  onClick={() => setShowConfig(false)}
                  className="rounded-full p-1 text-gray-400 transition hover:text-gray-100"
                >
                  ✕
                </button>
              </div>
              <label className="mt-3 flex items-center justify-between text-[0.7rem] text-gray-200">
                <span>Ndalo tingujt</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border border-emerald-400/40 bg-transparent text-emerald-400 focus:ring-emerald-500"
                  checked={muted}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setMuted(next);
                    setGameMuted(next);
                  }}
                />
              </label>
              <label className="mt-3 flex items-center justify-between text-[0.7rem] text-gray-200">
                <span>Shfaq gjurmën e lëvizjes</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border border-emerald-400/40 bg-transparent text-emerald-400 focus:ring-emerald-500"
                  checked={showTrailEnabled}
                  onChange={(event) => setShowTrailEnabled(event.target.checked)}
                />
              </label>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 w-full rounded-lg bg-emerald-500/20 py-2 text-center text-[0.7rem] font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
              >
                Rifillo lojën
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="relative z-10 flex flex-col justify-end items-center w-full h-full p-4 pb-32 space-y-4 pointer-events-none">
        {/* Bottom left controls */}
        <div className="pointer-events-auto w-full">
          <BottomLeftIcons
            onInfo={() => setShowInfo(true)}
            onChat={() => setShowChat(true)}
            onGift={() => setShowGift(true)}
          />
        </div>
        {/* Player photos stacked vertically */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          {players.map((player, seat) => {
            const p = { ...player, index: seat };
            const seatIndex = Number.isFinite(player.seatIndex) ? player.seatIndex : seat;
            const anchor = seatAnchorMap.get(seatIndex);
            const fallback =
              FALLBACK_SEAT_POSITIONS[seatIndex] || FALLBACK_SEAT_POSITIONS[FALLBACK_SEAT_POSITIONS.length - 1];
            const positionStyle = anchor
              ? {
                  position: 'absolute',
                  left: `${anchor.x}%`,
                  top: `${anchor.y}%`,
                  transform: 'translate(-50%, -50%)'
                }
              : {
                  position: 'absolute',
                  left: fallback.left,
                  top: fallback.top,
                  transform: 'translate(-50%, -50%)'
                };
            const avatarSize = anchor ? clampValue(1.32 - (anchor.depth - 2.6) * 0.22, 0.86, 1.2) : 1;
            const tokenColor = p.color || playerColors[seat] || '#f97316';
            const tokenHighlight = lightenHex(tokenColor, 0.35);
            const tokenShadow = darkenHex(tokenColor, 0.45);
            return (
              <div
                key={`player-${p.index}`}
                className="absolute pointer-events-auto flex flex-col items-center"
                style={positionStyle}
              >
                <AvatarTimer
                  index={p.index}
                  photoUrl={p.photoUrl}
                  active={p.index === currentTurn}
                  rank={rankMap[p.index]}
                  name={getPlayerName(p.index)}
                  isTurn={p.index === currentTurn}
                  timerPct={p.index === currentTurn ? timeLeft / TURN_TIME : 1}
                  color={p.color}
                  size={avatarSize}
                  onClick={() => {
                    const myIdx = isMultiplayer
                      ? mpPlayers.findIndex((pl) => pl.id === accountId)
                      : 0;
                    if (p.index !== myIdx) setPlayerPopup(p);
                  }}
                />
                <div className="flex flex-col items-center gap-1 mt-2">
                  <div
                    className="relative w-5 h-5 rounded-full border border-white/40 shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
                    style={{
                      background: `radial-gradient(circle at 30% 30%, ${tokenHighlight}, ${tokenColor})`,
                      boxShadow: `0 4px 8px ${tokenShadow}55`
                    }}
                  >
                    <span className="absolute inset-[28%] rounded-full bg-white/80 opacity-80 mix-blend-screen" />
                  </div>
                  <span className="text-[0.55rem] font-semibold uppercase tracking-widest text-slate-100/85">
                    Token
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      {chatBubbles.map((b) => (
        <div key={b.id} className="chat-bubble">
          <span>{b.text}</span>
          <img src={b.photoUrl} className="w-5 h-5 rounded-full" />
        </div>
      ))}
      <div className="pointer-events-auto">
        <PlayerPopup
          open={!!playerPopup}
          player={playerPopup}
          onClose={() => setPlayerPopup(null)}
        />
      </div>
      <div className="pointer-events-auto">
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
      </div>
      <div className="pointer-events-auto">
        {(() => {
          const myIdx = isMultiplayer
            ? mpPlayers.findIndex((p) => p.id === accountId)
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
                  icon.className = 'w-5 h-5';
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
      </div>
      {waitingForPlayers && playersNeeded > 0 && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70 text-white">
          <p className="text-lg mb-2">
            Waiting for {playersNeeded} more player{playersNeeded === 1 ? '' : 's'}...
          </p>
          <ul className="space-y-1 text-sm">
            {mpPlayers.map((p) => (
              <li key={p.id} className="flex items-center space-x-2">
                {p.photoUrl && (
                  <img src={p.photoUrl} alt="avatar" className="w-5 h-5 rounded-full" />
                )}
                <span>{p.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {rewardDice > 0 && (
        <div className="fixed bottom-40 inset-x-0 flex justify-center z-30 pointer-events-none reward-dice-container">
          {Array.from({ length: rewardDice }).map((_, i) => (
            <img key={i}  src="/assets/icons/file_000000009160620a96f728f463de1c3f.webp" className="reward-dice" />
          ))}
        </div>
      )}
      <div className={`absolute inset-0 pointer-events-none z-10 transition-opacity duration-300 ${diceVisibilityClass}`}>
        <div style={{ ...diceAnchorStyle, pointerEvents: 'none' }} className="flex items-center justify-center">
          <div
            className={`rounded-full border-2 transition-all duration-300 ${canRoll ? 'border-amber-300/70 bg-amber-200/12 animate-pulse' : 'border-white/12 bg-slate-900/35'}`}
            style={{ width: `${diceRingSize}px`, height: `${diceRingSize}px` }}
          />
        </div>
      </div>
      {!isMultiplayer && (
        <div className={`absolute inset-0 z-30 pointer-events-none transition-opacity duration-300 ${diceVisibilityClass}`}>
          <div style={{ ...diceAnchorStyle, pointerEvents: 'none' }}>
            <div
              className="pointer-events-auto flex items-center justify-center"
              style={{ width: `${diceButtonSize}px`, height: `${diceButtonSize}px` }}
            >
              <DiceRoller
                divRef={diceRollerDivRef}
                onRollEnd={(vals) => {
                  startDiceBoardAnimation({
                    id: diceRollIdRef.current,
                    phase: 'end',
                    values: vals,
                    seatIndex: aiRollingIndex ?? 0
                  });
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
                  diceRollIdRef.current += 1;
                  startDiceBoardAnimation({
                    id: diceRollIdRef.current,
                    phase: 'start',
                    count: diceCount + bonusDice,
                    seatIndex: aiRollingIndex ?? 0
                  });
                  if (timerRef.current) clearInterval(timerRef.current);
                  timerSoundRef.current?.pause();
                  setRollingIndex(aiRollingIndex || 0);
                  if (aiRollingIndex)
                    return setTurnMessage(<>{playerName(aiRollingIndex)} rolling...</>);
                  if (playerAutoRolling) return setTurnMessage('Rolling...');
                  return setTurnMessage('Rolling...');
                }}
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
                renderVisual={false}
                placeholder={
                  <span
                    className={`text-[0.65rem] font-semibold uppercase tracking-widest ${canRoll ? 'text-amber-200' : 'text-slate-300/70'}`}
                  >
                    {canRoll ? 'Tap Dice' : ''}
                  </span>
                }
                diceWrapperClassName={`w-full h-full rounded-full border-2 flex items-center justify-center shadow-[0_0_20px_rgba(250,204,21,0.25)] ${
                  canRoll ? 'border-amber-300/80 bg-amber-200/15 animate-pulse' : 'border-white/15 bg-slate-900/45'
                }`}
                className="pointer-events-auto w-full h-full space-y-0"
              />
            </div>
          </div>
        </div>
      )}
      {isMultiplayer && myPlayerIndex !== null && (
        <div className={`absolute inset-0 z-30 pointer-events-none transition-opacity duration-300 ${diceVisibilityClass}`}>
          <div style={{ ...diceAnchorStyle, pointerEvents: 'none' }}>
            <div
              className="pointer-events-auto flex items-center justify-center"
              style={{ width: `${diceButtonSize}px`, height: `${diceButtonSize}px` }}
              onClick={() => {
                if (canRoll) diceRollerDivRef.current?.click();
              }}
            >
              {currentTurn === myPlayerIndex && !moving ? (
                <DiceRoller
                  clickable
                  showButton={false}
                  muted={muted}
                  emitRollEvent
                  divRef={diceRollerDivRef}
                  renderVisual={false}
                  placeholder={
                    <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-amber-200">
                      Tap Dice
                    </span>
                  }
                  diceWrapperClassName={`w-full h-full rounded-full border-2 flex items-center justify-center shadow-[0_0_20px_rgba(250,204,21,0.25)] ${
                    canRoll ? 'border-amber-300/80 bg-amber-200/15 animate-pulse' : 'border-white/15 bg-slate-900/45'
                  }`}
                  className="pointer-events-auto w-full h-full space-y-0"
                  onRollStart={() => {
                    diceRollIdRef.current += 1;
                    startDiceBoardAnimation({
                      id: diceRollIdRef.current,
                      phase: 'start',
                      count: diceCount + bonusDice,
                      seatIndex: currentTurn
                    });
                  }}
                  onRollEnd={(vals) => {
                    startDiceBoardAnimation({
                      id: diceRollIdRef.current,
                      phase: 'end',
                      values: vals,
                      seatIndex: currentTurn
                    });
                  }}
                />
              ) : (
                <div className="w-full h-full rounded-full border-2 border-white/12 bg-slate-900/35" />
              )}
            </div>
          </div>
        </div>
      )}
      {!watchOnly && (
        <div className="fixed bottom-6 inset-x-0 flex flex-col items-center z-30 pointer-events-none space-y-3">
          {displayedTurnMessage && (
            <div className="px-4 py-2 rounded-full bg-[rgba(7,10,18,0.7)] border border-[rgba(255,215,0,0.25)] text-white text-sm font-semibold backdrop-blur">
              {displayedTurnMessage}
            </div>
          )}
          {canRoll && (
            <button
              type="button"
              onClick={handleRollButtonClick}
              className="pointer-events-auto px-6 py-3 rounded-full font-semibold text-sm text-[#f7e7a4] shadow-lg bg-gradient-to-b from-[#2b2b2b] to-[#121212] border border-[rgba(255,215,0,0.45)]"
            >
              ROLL
            </button>
          )}
        </div>
      )}
      {!watchOnly && (
        <div className="pointer-events-auto">
          <InfoPopup
            open={showQuitInfo}
            onClose={() => setShowQuitInfo(false)}
            title="Warning"
            info="If you quit the game your funds will be lost and you will be placed last."
            widthClass="w-80"
          />
        </div>
      )}
      {!watchOnly && (
        <div className="pointer-events-auto">
          <InfoPopup
            open={showInfo}
            onClose={() => setShowInfo(false)}
            title="Snake & Ladder"
            info="Roll two dice each turn. Move forward by their sum. Ladders lift you up and snakes bring you down. You must land exactly on the pot tile to win."
          />
        </div>
      )}
      {!watchOnly && (
        <div className="pointer-events-auto">
          <HintPopup
            open={showExactHelp}
            onClose={() => setShowExactHelp(false)}
            message="You must roll the exact number to land on the pot."
          />
        </div>
      )}
      {!watchOnly && (
        <div className="pointer-events-auto">
          <InfoPopup
            open={connectionLost}
            onClose={() => setConnectionLost(false)}
            title="Connection Lost"
            info="Attempting to reconnect..."
          />
        </div>
      )}
      {!watchOnly && (
        <div className="pointer-events-auto">
          <InfoPopup
            open={forfeitMsg}
            onClose={() => setForfeitMsg(false)}
            title="Disconnected"
            info="You were disconnected too long and forfeited the match."
          />
        </div>
      )}
      {!watchOnly && (
        <div className="pointer-events-auto">
          <InfoPopup
            open={!!disconnectMsg}
            onClose={() => setDisconnectMsg(null)}
            title="Player Update"
            info={disconnectMsg}
          />
        </div>
      )}
      {!watchOnly && (
        <div className="pointer-events-auto">
          <InfoPopup
            open={!!cheatMsg}
            onClose={() => setCheatMsg(null)}
            title="Warning"
            info={cheatMsg}
          />
        </div>
      )}
      {!watchOnly && (
        <div className="pointer-events-auto">
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
                        : '/assets/icons/ezgif-54c96d8a9b9236.webp'
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
        </div>
      )}
      {watchOnly && (
        <div className="pointer-events-auto">
          <InfoPopup
            open={showWatchWelcome}
            onClose={() => setShowWatchWelcome(false)}
            title="Watching Game"
            info="You're watching this match. Support your player by sending NFT GIFs and chat messages. Watching is free, but each chat costs 10 TPC."
          />
        </div>
      )}
      <div className="pointer-events-auto">
        <GameEndPopup
          open={gameOver}
          ranking={ranking}
          onReturn={() => {
            localStorage.removeItem(`snakeGameState_${ai}`);
            navigate("/games/snake/lobby");
          }}
        />
      </div>
      {!watchOnly && (
        <div className="pointer-events-auto">
          <ConfirmPopup
            open={showLobbyConfirm}
            message="Your funds will be lost if you quit the game."
            confirmLabel="Return to Lobby"
            cancelLabel="Games"
            onConfirm={() => {
              localStorage.removeItem(`snakeGameState_${ai}`);
              navigate("/games/snake/lobby");
            }}
            onCancel={() => {
              localStorage.removeItem(`snakeGameState_${ai}`);
              navigate("/games");
            }}
          />
        </div>
      )}
      </div>
    </div>
  );
}
