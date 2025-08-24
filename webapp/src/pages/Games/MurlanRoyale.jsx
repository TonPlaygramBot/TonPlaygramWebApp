import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function MurlanRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <div className="relative w-full h-screen">
      <iframe
        src={`/murlan-royale.html${search}`}
        title="Murlan Royale"
        className="w-full h-full border-0"
      />
    </div>
  );
}
