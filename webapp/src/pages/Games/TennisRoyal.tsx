import React from 'react';
import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import MobileThreeTennisPrototype from '../../components/TennisRoyalGame.tsx';

export default function TennisRoyal() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <div className="relative w-full h-screen bg-[#050812]">
      <MobileThreeTennisPrototype search={search} />
    </div>
  );
}
