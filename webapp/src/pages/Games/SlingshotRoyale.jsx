import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function SlingshotRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <iframe
      src={`/slingshot-royale.html${search}`}
      title="Slingshot Royale"
      className="w-full h-[100dvh] border-0"
    />
  );
}
