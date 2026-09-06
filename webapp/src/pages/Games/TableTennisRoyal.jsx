import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LegacyTableTennisGame from '../../games/tabletennis/LegacyGame';
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
    [launch.character]
  );
  useEffect(() => {
    if (launch.mode === 'ai') return undefined;
    services.activate();
    return () => services.dispose();
  }, [launch.mode, services]);

  // Restore the portrait, swipe-controlled game from the September 1 build for
  // solo play. Online and career retain the authoritative TPG runtime so queue,
  // stake, seat, state and settlement behavior cannot diverge from the server.
  if (launch.mode === 'ai') return <LegacyTableTennisGame />;

  return (
    <TableTennisGame
      key={search}
      services={services}
      launch={launch}
      onLobby={() => navigate('/games/tabletennisroyal/lobby')}
    />
  );
}
