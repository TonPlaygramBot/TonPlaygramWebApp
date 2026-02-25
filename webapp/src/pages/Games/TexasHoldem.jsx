import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import useOnlineRoomSync from '../../hooks/useOnlineRoomSync.js';
import TexasHoldemArena from './TexasHoldemArena.jsx';

export default function TexasHoldem() {
  useTelegramBackButton();
  const { search } = useLocation();
  useOnlineRoomSync(search, 'Poker Player');
  return (
    <div className="relative w-full h-screen">
      <TexasHoldemArena search={search} />
    </div>
  );
}
