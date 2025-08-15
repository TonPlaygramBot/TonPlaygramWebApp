import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function GoalRush() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <iframe
      src={`/goal-rush.html${search}`}
      title="Goal Rush"
      className="w-full h-screen border-0"
    />
  );
}

