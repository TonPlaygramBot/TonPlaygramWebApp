import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
export default function BrickBreaker() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <div className="relative w-full h-[100dvh]">
      <iframe
        src={`/brick-breaker.html${search}`}
        title="Brick Breaker Royale"
        className="w-full h-full border-0"
      />
    </div>
  );
}
