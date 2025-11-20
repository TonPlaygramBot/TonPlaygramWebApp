import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function Tirana2040() {
  useTelegramBackButton();
  const { search } = useLocation();

  const iframeSrc = `${import.meta.env.BASE_URL || '/'}tirana-2040.html${search || ''}`;

  return (
    <div className="relative w-full h-[100dvh]">
      <iframe
        src={iframeSrc}
        title="Tirana 2040"
        className="w-full h-full border-0"
        allow="accelerometer; gyroscope; fullscreen"
      />
    </div>
  );
}
