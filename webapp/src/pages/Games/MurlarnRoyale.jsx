import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function MurlarnRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <div className="relative w-full h-screen">
      <iframe
        src={`/murlarn-royale.html${search}`}
        title="Murlarn Royale"
        className="w-full h-full border-0"
      />
    </div>
  );
}
