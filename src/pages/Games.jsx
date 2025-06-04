import React from 'react';

export default function Games() {
  return (
    <div className="p-4 text-center">
      <h2 className="text-2xl font-bold mb-4">Games</h2>
      <button className="bg-accent text-white px-4 py-2 rounded flex items-center justify-center gap-2">
        <img src="/assets/play-game.png" alt="Play" className="w-4 h-4" />
        Play Game
      </button>
    </div>
  );
}
