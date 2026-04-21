import React from 'react';
import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import useOnlineRoomSync from '../../hooks/useOnlineRoomSync.js';
import MurlanRoyaleArena from './MurlanRoyaleArena.jsx';

export default function MurlanRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  useOnlineRoomSync(search, 'Murlan Player');

  return (
    <div className="relative w-full h-screen bg-[#050812]">
      <MurlanRoyaleArena search={search} />
    </div>
  );
}
