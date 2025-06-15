import React from 'react';

export default function Board({ playerPos, opponentPos, playerAvatar = '/assets/icons/profile.svg', opponentAvatar = '/assets/icons/profile.svg' }) {
  const cells = Array.from({ length: 100 }, (_, i) => i + 1);
  return (
    <div className="grid grid-cols-10 gap-1 max-w-md mx-auto">
      {cells.map((num) => (
        <div
          key={num}
          className="relative w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-xs border border-border bg-surface text-subtext"
        >
          {num}
          {playerPos === num && (
            <img
              src={playerAvatar}
              alt="You"
              className="absolute w-5 h-5 -top-1 -left-1 rounded-full border border-accent"
            />
          )}
          {opponentPos === num && (
            <img
              src={opponentAvatar}
              alt="Opponent"
              className="absolute w-5 h-5 -bottom-1 -right-1 rounded-full border border-primary"
            />
          )}
        </div>
      ))}
    </div>
  );
}
