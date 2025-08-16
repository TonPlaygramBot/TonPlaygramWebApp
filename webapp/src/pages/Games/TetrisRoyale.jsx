import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
export default function TetrisRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <div className="relative w-full h-screen">
      <iframe
        src={`/tetris-royale.html${search}`}
        title="Tetris Royale"
        className="w-full h-full border-0"
      />
    </div>
  );
}
