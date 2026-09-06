import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BowlingGame from '../../games/bowling/Game';
import { createAppBowlingServices } from '../../games/bowling/services';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function BowlingRoyal() {
  useTelegramBackButton();
  const { search } = useLocation(),
    navigate = useNavigate();
  const launch = useMemo(() => {
    const p = new URLSearchParams(search);
    return {
      mode: p.get('mode') === 'online' ? 'online' : 'ai',
      difficulty: Math.max(
        0,
        Math.min(2, Math.floor(Number(p.get('difficulty') ?? 1) || 0))
      ),
      tableId: p.get('tableId') || ''
    };
  }, [search]);
  const services = useMemo(() => createAppBowlingServices(), []);
  return (
    <BowlingGame
      key={search}
      launch={launch}
      services={services}
      onLobby={() => navigate('/games/bowlingroyal/lobby')}
    />
  );
}
