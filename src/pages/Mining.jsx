import React from 'react';

export default function Mining() {
  return (
    <div className="p-4 text-center">
      <h2 className="text-2xl font-bold mb-4">Mining</h2>
      <button className="bg-accent text-white px-4 py-2 rounded flex items-center justify-center gap-2">
        <img src="/assets/launch-bot.png" alt="Launch" className="w-4 h-4" />
        Launch Bot
      </button>
    </div>
  );
}
