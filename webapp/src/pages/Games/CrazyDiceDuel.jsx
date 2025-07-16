import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DiceRoller from '../../components/DiceRoller.jsx';
import AvatarTimer from '../../components/AvatarTimer.jsx';
import BottomLeftIcons from '../../components/BottomLeftIcons.jsx';
import QuickMessagePopup from '../../components/QuickMessagePopup.jsx';
import GiftPopup from '../../components/GiftPopup.jsx';
import GameEndPopup from '../../components/GameEndPopup.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  loadAvatar,
  avatarToName,
} from '../../utils/avatarUtils.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { LEADER_AVATARS } from '../../utils/leaderAvatars.js';
import { chatBeep, timerBeep } from '../../assets/soundData.js';
import { getGameVolume, isGameMuted } from '../../utils/sound.js';
import { giftSounds } from '../../utils/giftSounds.js';
import InfoPopup from '../../components/InfoPopup.jsx';
import ConfirmPopup from '../../components/ConfirmPopup.jsx';
import { ensureAccountId, getTelegramId } from '../../utils/telegram.js';
import { depositAccount, addTransaction } from '../../utils/api.js';

const COLORS = ['#60a5fa', '#ef4444', '#4ade80', '#facc15'];
const DEV_ACCOUNT = import.meta.env.VITE_DEV_ACCOUNT_ID;
const DEV_ACCOUNT_1 = import.meta.env.VITE_DEV_ACCOUNT_ID_1;
const DEV_ACCOUNT_2 = import.meta.env.VITE_DEV_ACCOUNT_ID_2;

async function awardDevShare(total) {
  const promises = [];
  if (DEV_ACCOUNT) {
    promises.push(
      depositAccount(DEV_ACCOUNT, Math.round(total * 0.09), {
        game: 'crazydice-dev',
      })
    );
  }
  if (DEV_ACCOUNT_1) {
    promises.push(
      depositAccount(DEV_ACCOUNT_1, Math.round(total * 0.01), {
        game: 'crazydice-dev1',
      })
    );
  }
  if (DEV_ACCOUNT_2) {
    promises.push(
      depositAccount(DEV_ACCOUNT_2, Math.round(total * 0.02), {
        game: 'crazydice-dev2',
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

export default function CrazyDiceDuel() {
  const navigate = useNavigate();
  const [showLobbyConfirm, setShowLobbyConfirm] = useState(false);
  const [showQuitInfo, setShowQuitInfo] = useState(true);
  const handleBack = useCallback(() => setShowLobbyConfirm(true), []);
  useTelegramBackButton(handleBack);
  const [searchParams] = useSearchParams();
  const aiCount = parseInt(searchParams.get('ai')) || 0;
  const avatarType = searchParams.get('avatars') || 'flags';
  const playerCount = aiCount > 0
    ? aiCount + 1
    : parseInt(searchParams.get('players')) || 2;
  const maxRolls = parseInt(searchParams.get('rolls')) || 1;
  const token = searchParams.get('token') || 'TPC';
  const amount = Number(searchParams.get('amount')) || 0;

  useEffect(() => {
    ensureAccountId().catch(() => {});
  }, []);

  const [bgUnlocked, setBgUnlocked] = useState(() =>
    localStorage.getItem('crazyDiceBgUnlocked') === 'true',
  );

  const unlockBackground = () => {
    localStorage.setItem('crazyDiceBgUnlocked', 'true');
    setBgUnlocked(true);
  };

  const initialPlayers = useMemo(() => {
    const randFlag = () =>
      FLAG_EMOJIS[Math.floor(Math.random() * FLAG_EMOJIS.length)];
    const randLeader = () =>
      LEADER_AVATARS[Math.floor(Math.random() * LEADER_AVATARS.length)];
    return Array.from({ length: playerCount }, (_, i) => ({
      score: 0,
      rolls: 0,
      results: [],
      photoUrl:
        i === 0
          ? loadAvatar() || '/assets/icons/profile.svg'
          : aiCount > 0
            ? avatarType === 'leaders'
              ? randLeader()
              : randFlag()
            : `/assets/avatars/avatar${(i % 5) + 1}.svg`,
      color: COLORS[i % COLORS.length],
    }));
  }, [playerCount, aiCount, avatarType]);

  const [players, setPlayers] = useState(initialPlayers);
  const [current, setCurrent] = useState(0);
  const [trigger, setTrigger] = useState(0);
  const [winner, setWinner] = useState(null);
  const [tiePlayers, setTiePlayers] = useState(null);
  const ranking = useMemo(
    () =>
      players
        .map((p, i) => ({
          name:
            i === 0
              ? 'You'
              : aiCount > 0
                ? avatarToName(p.photoUrl) || `AI ${i}`
                : `P${i + 1}`,
          score: p.score,
        }))
        .sort((a, b) => b.score - a.score)
        .map((p) => p.name),
    [players, aiCount],
  );
  const [showChat, setShowChat] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [chatBubbles, setChatBubbles] = useState([]);
  const [muted, setMuted] = useState(isGameMuted());
  const [timeLeft, setTimeLeft] = useState(15);
  const timerRef = useRef(null);
  const timerSoundRef = useRef(null);

  // Board background changes depending on number of opponents
  const BG_BY_PLAYERS = {
    // Backgrounds were renamed in a recent update
    2: '/assets/icons/file_00000000c9bc61f5825aa75d64fe234a.webp', // 1v1
    3: '/assets/icons/file_000000008b1061f68f37fd941a1efcb4.webp', // vs 2 others
    4: '/assets/icons/file_000000003a9c622f8e50bd5d8f381471.webp', // vs 3 others
  };
  const boardBgSrc = BG_BY_PLAYERS[playerCount] || BG_BY_PLAYERS[4];
  const boardClass = playerCount === 4 ? "four-players" : playerCount === 3 ? "three-players" : playerCount === 2 ? "two-players" : "";

  const boardRef = useRef(null);
  const diceRef = useRef(null);
  const diceCenterRef = useRef(null);
  const [diceStyle, setDiceStyle] = useState({ display: 'none' });
  const [rollResult, setRollResult] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showTrail, setShowTrail] = useState(false);
  const trailTimeoutRef = useRef(null);
  // Dice scales: shrink when at a player's position and expand when rolling
  // In 1v1 mode dice should start small and grow to normal size when rolling
  const DICE_CENTER_SCALE = 0.9;
  const DICE_PLAYER_SCALE = 0.4;
  const DICE_SHRINK_SCALE = 0.2;
  const DICE_ANIM_DURATION = 1000;

  const [tlScoreStyle, setTlScoreStyle] = useState(null);
  const [tlHistoryStyle, setTlHistoryStyle] = useState(null);
  const [trScoreStyle, setTrScoreStyle] = useState(null);
  const [trHistoryStyle, setTrHistoryStyle] = useState(null);
  const [p4ScoreStyles, setP4ScoreStyles] = useState([]);
  const [p4HistoryStyles, setP4HistoryStyles] = useState([]);

  // Board grid size for positioning helpers. Updated to match the
  // new Crazy Dice board layout which uses a 20x30 grid.
  const GRID_ROWS = 30;
  const GRID_COLS = 20;

  const gridCenter = (label) => {
    const col = label.charCodeAt(0) - 65;
    const row = parseInt(label.slice(1), 10) - 1;
    return {
      left: `${((col + 0.5) / GRID_COLS) * 100}%`,
      top: `${((row + 0.5) / GRID_ROWS) * 100}%`,
    };
  };

  const gridPoint = (col, row) => ({
    left: `${(col / GRID_COLS) * 100}%`,
    top: `${(row / GRID_ROWS) * 100}%`,
  });

  useEffect(() => {
    timerSoundRef.current = new Audio(timerBeep);
    timerSoundRef.current.volume = getGameVolume();
    return () => timerSoundRef.current?.pause();
  }, []);



  useEffect(() => {
    const handler = () => setMuted(isGameMuted());
    window.addEventListener('gameMuteChanged', handler);
    return () => window.removeEventListener('gameMuteChanged', handler);
  }, []);

  useEffect(() => {
    setShowPrompt(current === 0);
  }, [current]);

  useEffect(() => {
    if (playerCount !== 3) return;
    const update = () => {
      if (!boardRef.current) return;
      const board = boardRef.current.getBoundingClientRect();
      const cellW = board.width / GRID_COLS;
      const cellH = board.height / GRID_ROWS;
      const center = (c, r) => ({
        left: board.left + cellW * (c + 0.5),
        top: board.top + cellH * (r + 0.5),
      });
      setTlScoreStyle({
        position: 'fixed',
        transform: 'translate(-50%, -50%)',
        ...center(2, 10), // top left score (same as 4 players)
      });
      setTlHistoryStyle({
        position: 'fixed',
        transform: 'translate(-50%, -50%)',
        ...center(0.5, 11), // top left history (same as 4 players)
      });
      setTrScoreStyle({
        position: 'fixed',
        transform: 'translate(-50%, -50%)',
        ...center(16.5, 10), // top right score (same as 4 players)
      });
      setTrHistoryStyle({
        position: 'fixed',
        transform: 'translate(-50%, -50%)',
        ...center(15, 11), // top right history (same as 4 players)
      });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [playerCount]);

  useEffect(() => {
    if (playerCount !== 4) return;
    const update = () => {
      if (!boardRef.current) return;
      const board = boardRef.current.getBoundingClientRect();
      const cellW = board.width / GRID_COLS;
      const cellH = board.height / GRID_ROWS;
      const center = (c, r) => ({
        left: board.left + cellW * (c + 0.5),
        top: board.top + cellH * (r + 0.5),
      });
      setP4ScoreStyles([
        // Top left opponent score aligned with center
        { position: 'fixed', transform: 'translate(-50%, -50%)', ...center(2, 10) },
        // Top middle opponent score just below avatar
        { position: 'fixed', transform: 'translate(-50%, -50%)', ...center(9.5, 10) },
        // Top right opponent score aligned with center
        { position: 'fixed', transform: 'translate(-50%, -50%)', ...center(16.5, 10) },
      ]);
      setP4HistoryStyles([
        // Roll boxes for top left player
        { position: 'fixed', transform: 'translate(-50%, -50%)', ...center(0.5, 11) },
        // Roll boxes for top middle player
        { position: 'fixed', transform: 'translate(-50%, -50%)', ...center(8, 11) },
        // Roll boxes for top right player
        { position: 'fixed', transform: 'translate(-50%, -50%)', ...center(15, 11) },
      ]);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [playerCount]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerSoundRef.current?.pause();
    const isAI = aiCount > 0 && current > 0;
    if (isAI) {
      setTimeLeft(2.5);
      const end = Date.now() + 2500;
      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, (end - Date.now()) / 1000);
        if (remaining <= 0) {
          clearInterval(timerRef.current);
          setTrigger((t) => t + 1);
        }
        setTimeLeft(remaining);
      }, 100);
      return () => clearInterval(timerRef.current);
    }
    setTimeLeft(15);
    const end = Date.now() + 15000;
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, (end - Date.now()) / 1000);
      const isHumanTurn = aiCount === 0 || current === 0;
      if (
        isHumanTurn &&
        remaining <= 7 &&
        Math.ceil(remaining) !== Math.ceil(timeLeft) &&
        timerSoundRef.current
      ) {
        timerSoundRef.current.currentTime = 0;
        if (!muted) timerSoundRef.current.play().catch(() => {});
      }
      if (remaining <= 0) {
        timerSoundRef.current?.pause();
        clearInterval(timerRef.current);
        setTrigger((t) => t + 1);
      }
      setTimeLeft(remaining);
    }, 100);
    return () => {
      clearInterval(timerRef.current);
      timerSoundRef.current?.pause();
    };
  }, [current, aiCount, muted]);

  const getDiceCenter = (playerIdx = 'center') => {
      const posMap = {
        // Bottom player dice position
        0:
          playerCount === 2
            ? { label: 'J28' }
            : playerCount === 3
              ? { label: 'J28' }
              : { label: 'J28' },
        // Top left player position when playing vs two others
        1:
          playerCount === 2
            ? { label: 'J16' }
            : playerCount === 3
              ? { label: 'C14' }
              : { label: 'C14' },
        // Top right player position for three player games
        2:
          playerCount === 3
            ? { label: 'R14' }
            : { label: 'K20' },
        3: { label: 'R14' },
        // Dice roll animation centre: adjust for player count
        center:
          playerCount === 2
            ? { label: 'J22' }
            : playerCount === 3
              ? { label: 'J20' }
              : { label: 'J20' },
      };
    if (typeof playerIdx === 'string' && /^[A-Za-z][0-9]+$/.test(playerIdx)) {
      const label = playerIdx.toUpperCase();
      if (boardRef.current) {
        const board = boardRef.current.getBoundingClientRect();
        const col = label.charCodeAt(0) - 65;
        const row = parseInt(label.slice(1)) - 1;
        const cellW = board.width / GRID_COLS;
        const cellH = board.height / GRID_ROWS;
        return {
          cx: board.left + cellW * (col + 0.5),
          cy: board.top + cellH * (row + 0.5),
        };
      }
    }
    const entry = posMap[playerIdx] || {};
    const label = entry.label;
    const dx = entry.dx || 0;
    if (label && boardRef.current) {
      const board = boardRef.current.getBoundingClientRect();
      const col = label.charCodeAt(0) - 65;
      const row = parseInt(label.slice(1)) - 1;
      const cellW = board.width / GRID_COLS;
      const cellH = board.height / GRID_ROWS;
      return {
        cx: board.left + cellW * (col + 0.5 + dx),
        cy: board.top + cellH * (row + 0.5),
      };
    }
    const rect = diceCenterRef.current?.getBoundingClientRect();
    return {
      cx: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
      cy: rect ? rect.top + rect.height / 2 : window.innerHeight / 2,
    };
  };

  const prepareDiceAnimation = (idx) => {
    if (idx == null) {
      const { cx, cy } = getDiceCenter('center');
      setDiceStyle({
        display: 'none',
        position: 'fixed',
        left: '0px',
        top: '0px',
        transform: `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(${DICE_CENTER_SCALE})`,
        pointerEvents: 'none',
        zIndex: 50,
      });
      return;
    }
    const { cx, cy } = getDiceCenter(idx);
    setDiceStyle({
      display: 'none',
      position: 'fixed',
      left: '0px',
      top: '0px',
      transform: `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(${DICE_PLAYER_SCALE})`,
      pointerEvents: 'none',
      zIndex: 50,
    });
  };

  const animateDiceToCenter = (idx) => {
    const dice = diceRef.current;
    if (!dice) return;
    const { cx: startX, cy: startY } = getDiceCenter(idx);
    const { cx, cy } = getDiceCenter('center');
    dice.style.display = 'block';
    dice.style.position = 'fixed';
    dice.style.left = '0px';
    dice.style.top = '0px';
    dice.style.pointerEvents = 'none';
    dice.style.zIndex = '50';
    dice.animate(
      [
        { transform: `translate(${startX}px, ${startY}px) translate(-50%, -50%) scale(${DICE_PLAYER_SCALE})` },
        { transform: `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(${DICE_CENTER_SCALE})` },
      ],
      { duration: DICE_ANIM_DURATION, easing: 'ease-in-out' },
    ).onfinish = () => {
      setDiceStyle({
        display: 'block',
        position: 'fixed',
        left: '0px',
        top: '0px',
        transform: `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(${DICE_CENTER_SCALE})`,
        pointerEvents: 'none',
        zIndex: 50,
      });
    };
  };

  const animateDiceToPlayer = (idx) => {
    const dice = diceRef.current;
    if (!dice) return;
    const { cx: startX, cy: startY } = getDiceCenter('center');
    const { cx: endX, cy: endY } = getDiceCenter(idx);
    dice.animate(
      [
        { transform: `translate(${startX}px, ${startY}px) translate(-50%, -50%) scale(${DICE_CENTER_SCALE})` },
        { transform: `translate(${endX}px, ${endY}px) translate(-50%, -50%) scale(${DICE_PLAYER_SCALE})` },
      ],
      { duration: DICE_ANIM_DURATION, easing: 'ease-in-out' },
    ).onfinish = () => {
      setDiceStyle({ display: 'none' });
    };
  };

  const animateDiceToLabel = (label, endScale = DICE_SHRINK_SCALE) => {
    const dice = diceRef.current;
    if (!dice) return;
    const { cx: startX, cy: startY } = getDiceCenter('center');
    const { cx: endX, cy: endY } = getDiceCenter(label);
    dice.animate(
      [
        { transform: `translate(${startX}px, ${startY}px) translate(-50%, -50%) scale(${DICE_CENTER_SCALE})` },
        { transform: `translate(${endX}px, ${endY}px) translate(-50%, -50%) scale(${endScale})` },
      ],
      { duration: DICE_ANIM_DURATION, easing: 'ease-in-out' },
    ).onfinish = () => {
      setDiceStyle({ display: 'none' });
    };
  };

  const handleRollStart = () => {
    setShowPrompt(false);
    prepareDiceAnimation(current);
    animateDiceToCenter(current);
    if (current === 0) {
      setShowTrail(true);
      clearTimeout(trailTimeoutRef.current);
      trailTimeoutRef.current = setTimeout(
        () => setShowTrail(false),
        DICE_ANIM_DURATION
      );
    } else {
      setShowTrail(false);
    }
  };

  const handleRollEnd = (values) => {
    const value = Array.isArray(values) ? values.reduce((a, b) => a + b, 0) : values;
    let nextIndex = current;
    setPlayers((prev) => {
      const updated = prev.map((p, idx) =>
        idx === current
          ? {
              ...p,
              score: p.score + value,
              rolls: p.rolls + 1,
              results: [...p.results, value],
            }
          : p
      );
      nextIndex = (current + 1) % updated.length;
      let attempts = 0;
      while (updated[nextIndex].rolls >= maxRolls && attempts < updated.length) {
        nextIndex = (nextIndex + 1) % updated.length;
        attempts += 1;
      }
      return updated;
    });
    setRollResult(value);
    setTimeout(() => setRollResult(null), 2000);
    setTimeout(() => {
      if (playerCount === 4 && current === 1) {
        animateDiceToLabel('K13');
        setTimeout(() => setCurrent(nextIndex), DICE_ANIM_DURATION);
      } else {
        animateDiceToPlayer(nextIndex);
        setTimeout(() => setCurrent(nextIndex), DICE_ANIM_DURATION);
      }
    }, 2000);
  };

  const rollNow = () => {
    if (current === 0) {
      setShowPrompt(false);
      setTrigger((t) => t + 1);
    }
  };




  const allRolled = players.every((p) => p.rolls >= maxRolls);

  useEffect(() => {
    if (winner == null && allRolled) {
      const max = Math.max(...players.map((p) => p.score));
      const leaders = players.filter((p) => p.score === max);
      if (leaders.length === 1) {
        setWinner(players.indexOf(leaders[0]));
      } else {
        // tie break
        setTiePlayers(leaders.map((p) => players.indexOf(p)));
        setPlayers((prev) => prev.map((p) => ({ ...p, rolls: 0, results: [] })));
      }
      setCurrent(0);
    }
  }, [allRolled, players, winner, maxRolls]);

  useEffect(() => {
    if (tiePlayers && players.every((p) => p.rolls >= maxRolls)) {
      const max = Math.max(...players.map((p) => p.score));
      const leaders = players.filter((p) => p.score === max);
      if (leaders.length === 1) {
        setWinner(players.indexOf(leaders[0]));
      } else {
        setPlayers((prev) => prev.map((p) => ({ ...p, rolls: 0, results: [] })));
      }
      setCurrent(0);
    }
  }, [players, tiePlayers, maxRolls]);

  useEffect(() => {
    if (winner === null) return;
    if (token !== 'TPC' || amount <= 0) return;
    const total = amount * playerCount;
    const reward = async () => {
      if (winner === 0) {
        try {
          const aid = await ensureAccountId();
          const winAmt = Math.round(total * 0.91);
          await Promise.all([
            depositAccount(aid, winAmt, { game: 'crazydice-win' }),
            awardDevShare(total),
          ]);
          const tgId = getTelegramId();
          addTransaction(tgId, 0, 'win', {
            game: 'crazydice',
            players: playerCount,
            accountId: aid,
          });
        } catch {}
      } else {
        awardDevShare(total).catch(() => {});
      }
    };
    reward();
  }, [winner]);

  useEffect(() => {
    return () => clearTimeout(trailTimeoutRef.current);
  }, []);



  return (
    <div className="text-text relative">
      {bgUnlocked && (
        <img
          src="/assets/SnakeLaddersbackground.png"
          className="background-behind-board crazy-dice-bg object-cover"
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
        <div
          ref={boardRef}
          className={`crazy-dice-board ${boardClass}`}
        >
      {!bgUnlocked && (
        <button
          onClick={unlockBackground}
          className="absolute top-2 right-2 z-20 px-2 py-1 text-sm bg-primary hover:bg-primary-hover text-background rounded"
        >
          Unlock Background
        </button>
      )}
      <img src={boardBgSrc} alt="board" className="board-bg" />
      <div ref={diceCenterRef} className="dice-center" />
      <div ref={diceRef} style={diceStyle} className="dice-travel flex flex-col items-center relative">
        {showTrail && (
          <img
            src="/assets/icons/file_00000000926061f590feca40199ee88d.webp"
            alt=""
            className="dice-trail-img"
          />
        )}
        {rollResult !== null && (
          <div className="text-6xl roll-result">{rollResult}</div>
        )}
        {winner == null ? (
          <div className="crazy-dice">
            <DiceRoller
              onRollEnd={handleRollEnd}
              onRollStart={handleRollStart}
              trigger={trigger}
              clickable={aiCount === 0 || current === 0}
              showButton={aiCount === 0 || current === 0}
            />
          </div>
        ) : (
          <div className="text-2xl font-bold text-center">
            Player {winner + 1} wins!
          </div>
        )}
      </div>
      <div
        className="player-bottom z-10"
        style={{
          bottom: 'auto',
          /* Lift the bottom player a touch */
          ...gridPoint(10, 25.5),
          transform: 'translate(-50%, -50%)',
        }}
      >
        {showPrompt && (
          <button
            className="your-turn-message"
            style={{ color: players[0].color }}
            onClick={rollNow}
          >
            🫵 you're turn
          </button>
        )}
        <AvatarTimer
          index={0}
          photoUrl={players[0].photoUrl}
          active={current === 0}
          isTurn={current === 0}
          timerPct={current === 0 ? timeLeft / 15 : 1}
          name="You"
          score={players[0].score}
          rollHistory={players[0].results}
          maxRolls={maxRolls}
          color={players[0].color}
          size={
            playerCount === 3 ? 1.1 : playerCount > 3 ? 1.05 : 1
          }
          onClick={rollNow}
        />
      </div>
      {players.slice(1).map((p, i) => {
        const positions =
          playerCount === 3
            ? ['player-left', 'player-right']
            : playerCount === 2
              ? ['player-center']
              : ['player-left', 'player-center', 'player-right'];
        const pos = positions[i] || '';
        let wrapperStyle = undefined;
        let scoreStyle = undefined;
        let historyStyle = undefined;
        if (playerCount === 4) {
          if (i === 0) {
            /* Top left opponent moved slightly right */
            const pos = gridPoint(2.3, 6.5);
            wrapperStyle = { left: pos.left, top: pos.top, right: 'auto' };
          } else if (i === 1) {
            /* Top middle opponent */
            const pos = gridPoint(10, 6.5);
            wrapperStyle = { left: pos.left, top: pos.top, right: 'auto' };
          } else if (i === 2) {
            /* Top right opponent shifted slightly left */
            const pos = gridPoint(17.7, 6.5);
            wrapperStyle = { top: pos.top, right: `${100 - parseFloat(pos.left)}%` };
          }
          scoreStyle = undefined;
          historyStyle = undefined;
        }
        if (playerCount === 3) {
          if (i === 0) {
            // Nudge the top left opponent slightly left and up
            wrapperStyle = { ...gridPoint(3.3, 6.2), right: 'auto' };
          } else if (i === 1) {
            // Move the top right opponent slightly further left
            wrapperStyle = { ...gridPoint(15.5, 6.5), right: 'auto' };
          }
        }
        return (
          <div key={i + 1} className={`${pos} z-10`} style={wrapperStyle}>
            <AvatarTimer
              index={i + 1}
              photoUrl={p.photoUrl}
              active={current === i + 1}
              isTurn={current === i + 1}
              timerPct={current === i + 1 ? timeLeft / 2.5 : 1}
              name={
                aiCount > 0
                  ? avatarToName(p.photoUrl) || `AI ${i + 1}`
                  : `P${i + 2}`
              }
              score={p.score}
              rollHistory={p.results}
              maxRolls={maxRolls}
              color={p.color}
              scoreStyle={scoreStyle}
              rollHistoryStyle={historyStyle}
              size={
                playerCount === 2
                  ? 2
                  : playerCount === 3
                    ? 1.1
                    : playerCount === 4
                      ? 1.15
                      : playerCount > 4
                        ? 1.05
                        : 1
              }
              onClick={() => {
                if (current === i + 1) setTrigger((t) => t + 1);
              }}
            />
          </div>
        );
      })}
      {chatBubbles.map((b) => (
        <div key={b.id} className="chat-bubble">
          <span>{b.text}</span>
          <img src={b.photoUrl} className="w-6 h-6 rounded-full" />
        </div>
      ))}
      <BottomLeftIcons
        onInfo={() => {}}
        onChat={() => setShowChat(true)}
        onGift={() => setShowGift(true)}
      />
      <QuickMessagePopup
        open={showChat}
        onClose={() => setShowChat(false)}
        onSend={(text) => {
          const id = Date.now();
          setChatBubbles((b) => [...b, { id, text, photoUrl: players[0].photoUrl }]);
          if (!muted) {
            const a = new Audio(chatBeep);
            a.volume = getGameVolume();
            a.play().catch(() => {});
          }
          setTimeout(() => setChatBubbles((b) => b.filter((bb) => bb.id !== id)), 3000);
        }}
      />
      <GiftPopup
        open={showGift}
        onClose={() => setShowGift(false)}
        players={players.map((p, i) => ({
          ...p,
          index: i,
          name:
            i === 0
              ? 'You'
              : aiCount > 0
                ? avatarToName(p.photoUrl) || `AI ${i}`
                : `P${i + 1}`,
        }))}
        senderIndex={0}
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
            if (giftSound && !muted) {
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
              { duration: 3500, easing: 'linear' },
            );
            animation.onfinish = () => icon.remove();
          }
        }}
      />
      <GameEndPopup
        open={winner != null}
        ranking={ranking}
        onPlayAgain={() => window.location.reload()}
        onReturn={() => navigate('/games/crazydice/lobby')}
      />
      <InfoPopup
        open={showQuitInfo}
        onClose={() => setShowQuitInfo(false)}
        title="Warning"
        info="If you quit the game your funds will be lost and you will be placed last."
      />
      <ConfirmPopup
        open={showLobbyConfirm}
        message="Quit the game? If you leave, your funds will be lost and you'll be placed last."
        onConfirm={() => navigate('/games/crazydice/lobby')}
        onCancel={() => setShowLobbyConfirm(false)}
      />
      </div>
    </div>
  );
}
