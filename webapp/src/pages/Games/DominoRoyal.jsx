import { useLocation } from 'react-router-dom';

import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import DominoRoyalArena from './DominoRoyalArena.jsx';

export default function DominoRoyal() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <div className="relative w-full h-screen">
      <DominoRoyalArena search={search} />
    </div>
  );
}
