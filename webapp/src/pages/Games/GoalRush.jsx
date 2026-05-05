import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import GoalRush3DUpgrade from '../../components/GoalRush3DUpgrade';
import useOnlineRoomSync from '../../hooks/useOnlineRoomSync.js';

export default function GoalRush() {
  useTelegramBackButton();
  const { search } = useLocation();
  useOnlineRoomSync(search, 'Goal Rush Player');

  return <GoalRush3DUpgrade />;
}
