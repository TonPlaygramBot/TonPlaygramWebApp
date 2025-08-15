import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import GameFrame from '../../components/GameFrame.jsx';

export default function BrickBreaker() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <GameFrame
      src={`/brick-breaker.html${search}`}
      title="Brick Breaker Royale"
      info="Break all the bricks and outlast opponents to win the round."
    />
  );
}
