import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TennisGame from '../../games/tennis/Game';
import { createAppTennisServices } from '../../games/tennis/services';
import '../../games/tennis/game.css';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function TennisRoyal() {
  useTelegramBackButton();
  const navigate = useNavigate(),
    { search } = useLocation();
  const launch = useMemo(() => {
    const p = new URLSearchParams(search);
    return {
      mode: ['online', 'career'].includes(p.get('mode')) ? p.get('mode') : 'ai',
      surface: ['hard', 'clay', 'grass'].includes(p.get('surface'))
        ? p.get('surface')
        : 'hard',
      difficulty: Math.max(0, Math.min(2, Number(p.get('difficulty')) || 0)),
      format: ['quick', 'set', 'full'].includes(p.get('format'))
        ? p.get('format')
        : 'quick',
      tableId: p.get('tableId') || ''
    };
  }, [search]);
  const services = useMemo(() => createAppTennisServices(), [search]);
  useEffect(() => {
    services.activate();
    return () => services.dispose();
  }, [services]);
  return (
    <TennisGame
      key={search}
      services={services}
      launch={launch}
      onLobby={() => navigate('/games/tennisroyal/lobby')}
    />
  );
}
