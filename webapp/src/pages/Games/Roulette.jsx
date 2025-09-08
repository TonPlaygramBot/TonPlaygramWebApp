import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function Roulette() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <div className="relative w-full h-screen">
      <iframe
        src={`/roulette.html${search}`}
        title="Roulette"
        className="w-full h-full border-0"
      />
    </div>
  );
}
