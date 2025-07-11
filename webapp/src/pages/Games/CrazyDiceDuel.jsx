import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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

function GuideGrid() {
  const letters = 'ABCDEFGHIJ'.split('');
  const rows = Array.from({ length: 10 }, (_, i) => i + 1);
  return (
    <div className="guide-grid">
      {rows.map((r) =>
        letters.map((l) => (
          <div key={`${l}${r}`} className="grid-cell">
            {l}
            {r}
          </div>
        )),
      )}
    </div>
  );
}

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
  const diceRef = useRef(null);
  const boardRef = useRef(null);
  const [diceStyle, setDiceStyle] = useState({ display: 'none' });
  const DICE_SMALL_SCALE = 0.44;

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

  const handleRollEnd = (values) => {
    const value = Array.isArray(values) ? values.reduce((a, b) => a + b, 0) : values;
    setPlayers((prev) => {
      const nextPlayers = prev.map((p, idx) =>
        idx === current
          ? {
              ...p,
              score: p.score + value,
              rolls: p.rolls + 1,
              results: [...p.results, value],
            }
          : p
      );
      return nextPlayers;
    });
    let n = (current + 1) % players.length;
    while (players[n].rolls >= maxRolls) n = (n + 1) % players.length;
    animateDiceToCenter();
  };

  const prepareDiceAnimation = () => {
    setDiceStyle({
      display: 'block',
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%) scale(1)',
      transition: 'none',
      pointerEvents: 'none',
      zIndex: 50,
    });
  };

  const animateDiceToCenter = () => {
    setDiceStyle({
      display: 'block',
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%) scale(1)',
      pointerEvents: 'none',
      zIndex: 50,
    });
  };

  const animateDiceToPlayer = () => {
    setDiceStyle({
      display: 'block',
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%) scale(1)',
      pointerEvents: 'none',
      zIndex: 50,
    });
  };

  const nextTurn = () => {
    setCurrent((c) => {
      let n = (c + 1) % players.length;
      while (players[n].rolls >= maxRolls) n = (n + 1) % players.length;
      return n;
    });
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

  const onRollEnd = (values) => {
    handleRollEnd(values);
    nextTurn();
  };

  return (
    <div className="crazy-dice-board text-text" ref={boardRef}>
      <img
        src="/assets/icons/file_00000000316461fdac87111607fc8ada%20(1).png"
        alt="board"
        className="board-bg"
      />
      <GuideGrid />
      <div className="side-number top">1</div>
      <div className="side-number bottom">2</div>
      <div className="side-number left">3</div>
      <div className="side-number right">4</div>
      <div className="dice-center">
        {winner == null ? (
          <div
            ref={diceRef}
            style={diceStyle}
            className="dice-travel flex flex-col items-center"
          >
            <DiceRoller
              className="scale-[0.6]"
              onRollEnd={onRollEnd}
              onRollStart={() => {
                prepareDiceAnimation();
                animateDiceToCenter();
              }}
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
          onClick={() => {
            if (current === 0) setTrigger((t) => t + 1);
          }}
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
  );
}
