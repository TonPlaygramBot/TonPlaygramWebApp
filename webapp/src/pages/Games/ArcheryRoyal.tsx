import { useNavigate } from 'react-router-dom';
import ArcheryRoyalGame from '../../games/archeryroyal/ArcheryRoyalGame';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function ArcheryRoyal() {
  const navigate = useNavigate();
  useTelegramBackButton('/games/archeryroyal/lobby');
  return <ArcheryRoyalGame onLobby={() => navigate('/games/archeryroyal/lobby')} />;
}
