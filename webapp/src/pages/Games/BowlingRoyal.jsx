import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function BowlingRoyal() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <div className="relative w-full h-screen">
      <iframe
        src={`/bowling-royal.html${search}`}
        title="Bowling Royal"
        className="w-full h-full border-0"
        allow="fullscreen"
      />
    </div>
  );
}
