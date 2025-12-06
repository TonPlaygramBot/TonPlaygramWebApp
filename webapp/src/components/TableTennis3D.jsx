import React from 'react';
import ArcadeRacketGame from './ArcadeRacketGame.jsx';

export default function TableTennis3D({ player, ai }) {
  const playerName = player?.name || 'You';
  const playerAvatar = player?.avatar || '/assets/icons/profile.svg';
  const aiName = ai?.name || 'AI';
  const aiAvatar = ai?.avatar || '/assets/icons/profile.svg';

  return (
    <div className="relative w-full h-[100dvh] bg-[#0b1220]">
      <ArcadeRacketGame mode="tabletennis" title="Table Tennis 3D" trainingMode />

      <div className="pointer-events-none absolute top-0 left-0 right-0 flex items-center justify-between gap-3 p-3 text-white">
        <div className="flex items-center gap-2 rounded-2xl bg-black/30 px-3 py-2 shadow-lg backdrop-blur">
          <img
            src={playerAvatar}
            alt={playerName}
            className="h-10 w-10 rounded-full object-cover ring-2 ring-emerald-400/80"
          />
          <div className="leading-tight">
            <div className="text-xs opacity-80">Player</div>
            <div className="font-semibold">{playerName}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-black/30 px-3 py-2 shadow-lg backdrop-blur">
          <div className="text-right leading-tight">
            <div className="text-xs opacity-80">Opponent</div>
            <div className="font-semibold">{aiName}</div>
          </div>
          <img
            src={aiAvatar}
            alt={aiName}
            className="h-10 w-10 rounded-full object-cover ring-2 ring-rose-400/80"
          />
        </div>
      </div>
    </div>
  );
}
