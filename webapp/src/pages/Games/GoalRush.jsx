import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
export default function GoalRush() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <div className="relative w-full h-[100dvh]">
      <iframe
        src={`/goal-rush.html${search}`}
        title="Goal Rush"
        className="w-full h-full border-0"
      />
    </div>
  );
}

