import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function AirHockey() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <iframe
      src={`/air-hockey.html${search}`}
      title="Air Hockey"
      className="w-full h-screen border-0"
    />
  );
}

