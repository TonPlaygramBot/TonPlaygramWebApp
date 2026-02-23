import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import TexasHoldemArena from './TexasHoldemArena.jsx';

export default function TexasHoldem() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <div className="relative w-full h-screen">
      <TexasHoldemArena search={search} />
    </div>
  );
}
