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
      info="Move the paddle to keep the ball in play and smash all bricks to clear the level."
    />
  );
}
