import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function BrickBreaker() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <iframe
      src={`/brick-breaker.html${search}`}
      title="Brick Breaker Royale"
      className="w-full h-screen border-0"
    />
  );
}
