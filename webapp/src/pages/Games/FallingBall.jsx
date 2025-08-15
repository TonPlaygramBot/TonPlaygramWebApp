import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function FallingBall() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <iframe
      src={`/falling-ball.html${search}`}
      title="Falling Ball"
      className="w-full h-screen border-0"
    />
  );
}
