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
import { loadAvatar } from '../../utils/avatarUtils.js';
import { chatBeep, timerBeep } from '../../assets/soundData.js';
import { getGameVolume, isGameMuted } from '../../utils/sound.js';
import { giftSounds } from '../../utils/giftSounds.js';

const COLORS = ['#60a5fa', '#ef4444', '#4ade80', '#facc15'];

export default function CrazyDiceDuel() {
  const navigate = useNavigate();
  const handleBack = useCallback(
    () => navigate('/games/crazydice/lobby', { replace: true }),
    [navigate],
  );
  useTelegramBackButton(handleBack);
  const [searchParams] = useSearchParams();
  const aiCount = parseInt(searchParams.get('ai')) || 0;
  const playerCount = aiCount > 0
    ? aiCount + 1
    : parseInt(searchParams.get('players')) || 2;
  const maxRolls = parseInt(searchParams.get('rolls')) || 1;

  const [bgUnlocked, setBgUnlocked] = useState(() =>
    localStorage.getItem('crazyDiceBgUnlocked') === 'true',
  );

  const unlockBackground = () => {
    localStorage.setItem('crazyDiceBgUnlocked', 'true');
    setBgUnlocked(true);
  };

  const initialPlayers = useMemo(
    () =>
      Array.from({ length: playerCount }, (_, i) => ({
        score: 0,
        rolls: 0,
        results: [],
        photoUrl:
          i === 0
            ? loadAvatar() || '/assets/icons/profile.svg'
            : `/assets/avatars/avatar${(i % 5) + 1}.svg`,
        color: COLORS[i % COLORS.length],
      })),
    [playerCount],
  );

  const [players, setPlayers] = useState(initialPlayers);
  const [current, setCurrent] = useState(0);
  const [trigger, setTrigger] = useState(0);
  const [winner, setWinner] = useState(null);
  const [tiePlayers, setTiePlayers] = useState(null);
  const ranking = useMemo(
    () =>
      players
        .map((p, i) => ({ name: i === 0 ? 'You' : `P${i + 1}`, score: p.score }))
        .sort((a, b) => b.score - a.score)
        .map((p) => p.name),
    [players],
  );
  const [showChat, setShowChat] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [chatBubbles, setChatBubbles] = useState([]);
  const [muted, setMuted] = useState(isGameMuted());
  const [timeLeft, setTimeLeft] = useState(15);
  const timerRef = useRef(null);
  const timerSoundRef = useRef(null);

  const boardRef = useRef(null);
  const diceRef = useRef(null);
  const diceCenterRef = useRef(null);
  const [diceStyle, setDiceStyle] = useState({ display: 'none' });
  const [rollResult, setRollResult] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  // Dice scales: shrink when at a player's position and expand when rolling
  // Reduce dice size by 20% when idle or landing
  const DICE_CENTER_SCALE = 0.8;
  const DICE_PLAYER_SCALE = 0.48;
  const DICE_ANIM_DURATION = 1000;

  // Board grid size for positioning helpers
  const GRID_ROWS = 20;
  const GRID_COLS = 10;

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
    if (timerRef.current) clearInterval(timerRef.current);
    timerSoundRef.current?.pause();
    const isAI = aiCount > 0 && current > 0;
    if (isAI) {
      setTimeLeft(3.5);
      const end = Date.now() + 3500;
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
      0: { label: 'F19', dx: -0.1 }, // Player 1
      1: { label: 'B8', dx: -0.1 },  // Player 2
      2: { label: 'F8' },            // Player 3
      3: { label: 'J9' },            // Player 4
      center: { label: 'F12' },
    };
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

  const handleRollStart = () => {
    setShowPrompt(false);
    prepareDiceAnimation(current);
    animateDiceToCenter(current);
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
      while (updated[nextIndex].rolls >= maxRolls) nextIndex = (nextIndex + 1) % updated.length;
      return updated;
    });
    setRollResult(value);
    setTimeout(() => setRollResult(null), 2000);
    setTimeout(() => {
      animateDiceToPlayer(nextIndex);
      setTimeout(() => setCurrent(nextIndex), DICE_ANIM_DURATION);
    }, 2000);
  };

  const rollNow = () => {
    if (current === 0) {
      setShowPrompt(false);
      setTrigger((t) => t + 1);
    }
  };




  const allRolled = players.every((p) => p.rolls >= maxRolls);

  if (winner == null && allRolled) {
    const max = Math.max(...players.map((p) => p.score));
    const leaders = players.filter((p) => p.score === max);
    if (leaders.length === 1) {
      setWinner(players.indexOf(leaders[0]));
    } else {
      // tie break
      setTiePlayers(leaders.map((p, idx) => players.indexOf(p)));
      setPlayers((prev) => prev.map((p) => ({ ...p, rolls: 0, results: [] })));
    }
    setCurrent(0);
    return null;
  }

  if (tiePlayers && players.every((p) => p.rolls >= maxRolls)) {
    const max = Math.max(...players.map((p) => p.score));
    const leaders = players.filter((p) => p.score === max);
    if (leaders.length === 1) {
      setWinner(players.indexOf(leaders[0]));
    } else {
      setPlayers((prev) => prev.map((p) => ({ ...p, rolls: 0, results: [] }))); 
    }
    setCurrent(0);
    return null;
  }



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
      <div ref={boardRef} className="crazy-dice-board">
      {!bgUnlocked && (
        <button
          onClick={unlockBackground}
          className="absolute top-2 right-2 z-20 px-2 py-1 text-sm bg-primary hover:bg-primary-hover text-background rounded"
        >
          Unlock Background
        </button>
      )}
      <img
        src="/assets/icons/file_00000000d410620a8c1878be43e192a1.png"
        alt="board"
        className="board-bg"
      />
      <div ref={diceCenterRef} className="dice-center" />
      <div ref={diceRef} style={diceStyle} className="dice-travel flex flex-col items-center">
        {rollResult !== null && (
          <div className="text-5xl roll-result">{rollResult}</div>
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
      <div className="player-bottom z-10">
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
          onClick={rollNow}
        />
      </div>
      {players.slice(1).map((p, i) => {
        const pos = ['player-left', 'player-center', 'player-right'][i] || '';
        return (
          <div key={i + 1} className={`${pos} z-10`}>
          <AvatarTimer
            index={i + 1}
            photoUrl={p.photoUrl}
            active={current === i + 1}
            isTurn={current === i + 1}
            timerPct={current === i + 1 ? timeLeft / 3.5 : 1}
            name={`P${i + 2}`}
            score={p.score}
            rollHistory={p.results}
            maxRolls={maxRolls}
            color={p.color}
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
        players={players.map((p, i) => ({ ...p, index: i, name: `P${i + 1}` }))}
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
      </div>
    </div>
  );
}
