import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function PacManRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <iframe
      src={`/pacman-royale.html${search}`}
      title="Pac-Man Royale"
      className="w-full h-screen border-0"
    />
  );
}
