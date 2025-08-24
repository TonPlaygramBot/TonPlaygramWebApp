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
      info="Choose a slot and release the ball. Wherever it lands earns you points; highest total wins."
    />
  );
}
