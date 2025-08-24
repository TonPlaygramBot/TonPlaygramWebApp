import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function TexasHoldem() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <div className="relative w-full h-screen">
      <iframe
        src={`/texas-holdem.html${search}`}
        title="Texas Hold'em"
        className="w-full h-full border-0"
      />
    </div>
  );
}
