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
    <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden bg-[#050812]">
      <MurlanRoyaleArena search={search} />
    </div>
  );
}
