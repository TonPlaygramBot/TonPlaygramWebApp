import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
export default function BubbleSmashRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <div className="relative w-full h-screen">
      <iframe
        src={`/bubble-smash-royale.html${search}`}
        title="Bubble Smash Royale"
        className="w-full h-full border-0"
      />
    </div>
  );
}
