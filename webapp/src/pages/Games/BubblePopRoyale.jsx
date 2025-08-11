import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function BubblePopRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <iframe
      src={`/bubble-pop-royale.html${search}`}
      title="Bubble Pop Royale"
      className="w-full h-screen border-0"
    />
  );
}
