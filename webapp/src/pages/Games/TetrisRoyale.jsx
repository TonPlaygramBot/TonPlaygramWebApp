import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import GameFrame from '../../components/GameFrame.jsx';

export default function TetrisRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <GameFrame
      src={`/tetris-royale.html${search}`}
      title="Tetris Royale"
      info="Rotate and drop blocks to complete horizontal lines. Clearing lines earns points and keeps the field clear."
    />
  );
}
