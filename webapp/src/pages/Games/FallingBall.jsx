import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
export default function FallingBall() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <div className="relative w-full h-screen">
      <iframe
        src={`/falling-ball.html${search}`}
        title="Falling Ball"
        className="w-full h-full border-0"
      />
    </div>
  );
}
