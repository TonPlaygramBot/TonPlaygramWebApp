import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import DominoRoyalArena from './DominoRoyalArena.jsx';

export default function DominoRoyal() {
  useTelegramBackButton();

  return (
    <div className="relative w-full h-screen">
      <DominoRoyalArena />
    </div>
  );
}
