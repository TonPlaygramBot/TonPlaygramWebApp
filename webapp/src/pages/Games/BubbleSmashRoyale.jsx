import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function BubbleSmashRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <iframe
      src={`/bubble-smash-royale.html${search}`}
      title="Bubble Smash Royale"
      className="w-full h-[100dvh] border-0"
    />
  );
}
