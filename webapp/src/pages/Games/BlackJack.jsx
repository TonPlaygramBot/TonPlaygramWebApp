import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import BlackJackArena from './BlackJackArena.jsx';

export default function BlackJack() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <div className="relative w-full h-screen">
      <BlackJackArena search={search} />
    </div>
  );
}
