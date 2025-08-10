import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function Poker() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <iframe
      src={`/poker.html${search}`}
      title="Poker"
      className="w-full h-screen border-0"
    />
  );
}
