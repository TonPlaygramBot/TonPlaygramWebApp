import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function TetrisRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <iframe
      src={`/tetris-royale.html${search}`}
      title="Tetris Royale"
      className="w-full h-screen border-0"
    />
  );
}
