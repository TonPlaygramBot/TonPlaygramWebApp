import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function BlackJack() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <div className="relative w-full h-screen">
      <iframe
        src={`/blackjack.html${search}`}
        title="Black Jack"
        className="w-full h-full border-0"
      />
    </div>
  );
}
