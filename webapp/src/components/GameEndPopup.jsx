import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import coinConfetti from '../utils/coinConfetti';
import { loadAvatar } from '../utils/avatarUtils.js';

export default function GameEndPopup({ open, ranking = [], onReturn }) {
  if (!open) return null;

  const players = ranking.map((r, i) => {
    if (typeof r === 'string') {
      return {
        name: r,
        photoUrl: i === 0 ? loadAvatar() || '/assets/icons/profile.svg' : '/assets/icons/profile.svg',
        amount: 0,
      };
    }
    if (!r.photoUrl && i === 0) {
      return { ...r, photoUrl: loadAvatar() || '/assets/icons/profile.svg' };
    }
    return r;
  });

  useEffect(() => {
    coinConfetti();
    const snd = new Audio('/assets/sounds/11l-victory_sound_with_t-1749487412779-357604.mp3');
    snd.play().catch(() => {});
    return () => snd.pause();
  }, []);

  const winner = players[0];
  const others = players.slice(1);

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="bg-surface border border-border p-6 rounded space-y-4 text-text w-80 text-center">
        <p
          className="text-xl font-bold text-yellow-400"
          style={{ WebkitTextStroke: '1px black' }}
        >
          Winner 🏅
        </p>
        {winner && (
          <div className="flex items-center justify-center gap-2">
            <img
              src={winner.photoUrl}
              alt={winner.name}
              className="w-20 h-20 rounded-full"
            />
            <span className="flex items-center gap-1 font-semibold text-lg">
              {winner.amount}
              <img
                src="/assets/icons/ezgif-54c96d8a9b9236.webp"
                alt="TPC"
                className="w-5 h-5"
              />
            </span>
          </div>
        )}
        <ul className="space-y-2">
          {others.map((p, i) => (
            <li key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={p.photoUrl}
                  alt={p.name}
                  className="w-8 h-8 rounded-full"
                />
                <span>{p.name}</span>
              </div>
              <span className="flex items-center gap-1">
                {p.amount}
                <img
                  src="/assets/icons/ezgif-54c96d8a9b9236.webp"
                  alt="TPC"
                  className="w-4 h-4"
                />
              </span>
            </li>
          ))}
        </ul>
        <button
          onClick={onReturn}
          className="px-2 py-0.5 bg-primary hover:bg-primary-hover text-white-shadow text-sm rounded w-full"
        >
          Return to Lobby
        </button>
      </div>
    </div>,
    document.body,
  );
}
