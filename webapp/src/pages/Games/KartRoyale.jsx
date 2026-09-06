import { useNavigate } from 'react-router-dom';
import KartRoyaleGame from '../../games/kartroyale/KartRoyale';
import { getTelegramFirstName } from '../../utils/telegram.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import KartRoyaleMatchmaking from './KartRoyaleMatchmaking.jsx';
export default function KartRoyale() {
  const navigate = useNavigate();
  useTelegramBackButton();
  return (
    <KartRoyaleGame
      playerName={getTelegramFirstName() || 'Racer'}
      onExit={() => navigate('/games')}
      getSocket={async () => (await import('../../utils/socket.js')).socket}
      renderOnlineLobby={(props) => <KartRoyaleMatchmaking {...props} />}
    />
  );
}
