import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TableTennisGame from '../../games/tabletennis/Game';
import { createAppTableTennisServices } from '../../games/tabletennis/services';
import '../../games/tabletennis/game.css';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function TableTennisRoyal() {
  useTelegramBackButton();
  const navigate = useNavigate(),
    { search } = useLocation();
  const launch = useMemo(() => {
    const p = new URLSearchParams(search);
    return {
      mode: ['online', 'career'].includes(p.get('mode')) ? p.get('mode') : 'ai',
      arena: ['dancingHall', 'colorfulStudio', 'neonPhotostudio'].includes(
        p.get('arena')
      )
        ? p.get('arena')
        : 'dancingHall',
      character: p.get('character') || 'athlete-male',
      difficulty: Math.max(0, Math.min(2, Number(p.get('difficulty')) || 0)),
      format: ['quick', 'set', 'full'].includes(p.get('format'))
        ? p.get('format')
        : 'quick',
      tableId: p.get('tableId') || ''
    };
  }, [search]);
  const services = useMemo(
    () => createAppTableTennisServices(launch.character),
    [search]
  );
  useEffect(() => {
    services.activate();
    return () => services.dispose();
  }, [services]);
  return (
    <TableTennisGame
      key={search}
      services={services}
      launch={launch}
      onLobby={() => navigate('/games/tabletennisroyal/lobby')}
    />
  );
}
