import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import GameFrame from '../../components/GameFrame.jsx';

export default function GoalRush() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <GameFrame
      src={`/goal-rush.html${search}`}
      title="Goal Rush"
      info="Score goals and defeat your opponent in this fast paced match."
      layout="split"
    />
  );
}

