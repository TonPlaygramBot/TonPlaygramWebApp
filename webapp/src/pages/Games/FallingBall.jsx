import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import GameFrame from '../../components/GameFrame.jsx';

export default function FallingBall() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <GameFrame
      src={`/falling-ball.html${search}`}
      title="Falling Ball"
      info="Keep the ball in play and score points without letting it drop."
      layout="split"
    />
  );
}
