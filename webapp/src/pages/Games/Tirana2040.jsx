import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function Tirana2040() {
  useTelegramBackButton();
  const { search } = useLocation();

  return (
    <div className="relative w-full h-[100dvh]">
      <iframe
        src={`/tirana-2040.html${search}`}
        title="London 1990"
        className="w-full h-full border-0"
        allow="accelerometer; gyroscope; fullscreen"
      />
    </div>
  );
}
