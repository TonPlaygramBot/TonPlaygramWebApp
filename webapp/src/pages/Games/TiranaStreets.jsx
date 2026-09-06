import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import CityGame from '../../games/tiranastreets/CityGame';
import { createTiranaTransport } from '../../games/tiranastreets/appTransport';
import { getTelegramFirstName } from '../../utils/telegram.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function TiranaStreets() {
  useTelegramBackButton();
  const navigate = useNavigate();
  const name = getTelegramFirstName() || 'Driver';
  const transport = useMemo(() => createTiranaTransport(name), [name]);
  return (
    <CityGame
      playerName={name}
      transport={transport}
      onExit={() => navigate('/games')}
    />
  );
}
