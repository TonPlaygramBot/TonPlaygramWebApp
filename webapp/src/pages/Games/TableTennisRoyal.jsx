import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CHARACTERS,
  ARENAS,
  ownedAppearance
} from '../../games/tabletennis/options';
import TableTennisGame from '../../games/tabletennis/Game';
import { createAppTableTennisServices } from '../../games/tabletennis/services';
import '../../games/tabletennis/game.css';
import {
  getTelegramUsername,
  getTelegramFirstName,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import { loadAvatar } from '../../utils/avatarUtils.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function TableTennisRoyal() {
  useTelegramBackButton();
  const navigate = useNavigate(),
    { search } = useLocation();
  const cosmetics = useMemo(() => ownedAppearance(), []);
  const launch = useMemo(() => {
    const p = new URLSearchParams(search);
    const solo = !['online', 'career'].includes(p.get('mode'));
    const choices = solo
      ? cosmetics
      : { characters: CHARACTERS, arenas: ARENAS };
    let savedCharacter, savedArena;
    if (solo)
      try {
        savedCharacter = localStorage.getItem(
          'tableTennisSelectedHumanCharacter'
        );
        savedArena = localStorage.getItem('tableTennisSelectedHdri');
      } catch {}
    const requestedCharacter = p.get('character') || savedCharacter;
    const requestedArena = p.get('arena') || savedArena;
    return {
      mode: ['online', 'career'].includes(p.get('mode')) ? p.get('mode') : 'ai',
      arena: choices.arenas.some((a) => a.id === requestedArena)
        ? requestedArena
        : 'dancingHall',
      character: choices.characters.some((c) => c.id === requestedCharacter)
        ? requestedCharacter
        : 'athlete-male',
      difficulty: Math.max(0, Math.min(2, Number(p.get('difficulty')) || 0)),
      format: ['quick', 'set', 'full'].includes(p.get('format'))
        ? p.get('format')
        : 'quick',
      tableId: p.get('tableId') || ''
    };
  }, [search, cosmetics]);
  const services = useMemo(
    () => createAppTableTennisServices(launch.character),
    [launch.character]
  );
  useEffect(() => {
    if (launch.mode === 'ai') return undefined;
    services.activate();
    return () => services.dispose();
  }, [launch.mode, services]);

  return (
    <TableTennisGame
      key={search}
      services={services}
      profile={{
        name: getTelegramUsername()
          ? `@${getTelegramUsername()}`
          : getTelegramFirstName() || 'You',
        avatar: loadAvatar() || getTelegramPhotoUrl() || ''
      }}
      launch={launch}
      appearanceChoices={launch.mode === 'ai' ? cosmetics : undefined}
      onLobby={() => navigate('/games/tabletennisroyal/lobby')}
    />
  );
}
