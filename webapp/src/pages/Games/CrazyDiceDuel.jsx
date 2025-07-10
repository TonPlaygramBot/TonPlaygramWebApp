import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DiceRoller from '../../components/DiceRoller.jsx';
import AvatarTimer from '../../components/AvatarTimer.jsx';
import BottomLeftIcons from '../../components/BottomLeftIcons.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { loadAvatar } from '../../utils/avatarUtils.js';

const COLORS = ['#60a5fa', '#ef4444', '#4ade80', '#facc15'];

export default function CrazyDiceDuel() {
  const navigate = useNavigate();
  useTelegramBackButton(() => navigate('/games/crazydice/lobby', { replace: true }));
  const [searchParams] = useSearchParams();
  const playerCount = parseInt(searchParams.get('players')) || 2;
  const maxRolls = parseInt(searchParams.get('rolls')) || 1;

  const initialPlayers = useMemo(() => (
    Array.from({ length: playerCount }, (_, i) => ({
      score: 0,
      rolls: 0,
      photoUrl: loadAvatar() || '/assets/icons/profile.svg',
      color: COLORS[i % COLORS.length],
    }))
  ), [playerCount]);

  const [players, setPlayers] = useState(initialPlayers);
  const [current, setCurrent] = useState(0);
  const [trigger, setTrigger] = useState(0);
  const [winner, setWinner] = useState(null);
  const [tiePlayers, setTiePlayers] = useState(null);

  const handleRollEnd = (values) => {
    const value = Array.isArray(values) ? values.reduce((a, b) => a + b, 0) : values;
    setPlayers((prev) => {
      const next = prev.map((p, idx) =>
        idx === current ? { ...p, score: p.score + value, rolls: p.rolls + 1 } : p
      );
      return next;
    });
    setTrigger((t) => t + 1);
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
      setPlayers((prev) => prev.map((p) => ({ ...p, rolls: 0 })));
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
      setPlayers((prev) => prev.map((p) => ({ ...p, rolls: 0 })));
    }
    setCurrent(0);
    return null;
  }

  const onRollEnd = (values) => {
    handleRollEnd(values);
    nextTurn();
  };

  return (
    <div className="crazy-dice-board text-text">
      <img src="/assets/icons/file_00000000ce2461f7a5c5347320c3167c.webp" alt="board" className="board-bg" />
      <div className="dice-center">
        {winner == null ? (
          <DiceRoller onRollEnd={onRollEnd} trigger={trigger} />
        ) : (
          <div className="text-2xl font-bold text-center">
            Player {winner + 1} wins!
          </div>
        )}
      </div>
      <div className="fixed left-1 top-1/2 -translate-y-1/2 flex flex-col space-y-4 z-10">
        {players.map((p, i) => (
          <AvatarTimer
            key={i}
            index={i}
            photoUrl={p.photoUrl}
            active={i === current}
            timerPct={1}
            name={`P${i + 1}`}
            color={p.color}
          />
        ))}
      </div>
      <BottomLeftIcons onInfo={() => {}} />
    </div>
  );
}
