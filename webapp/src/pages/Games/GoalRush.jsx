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
      info="Slide your striker to block shots and send the puck into the opponent's goal. First to 7 points wins."
    />
  );
}

