import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function Snooker() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <div className="relative w-full h-[100dvh]">
      <iframe
        src={`/snooker.html${search}`}
        title="Snooker"
        className="w-full h-full border-0"
      />
    </div>
  );
}

