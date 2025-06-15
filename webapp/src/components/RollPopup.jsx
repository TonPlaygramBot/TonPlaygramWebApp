import React from 'react';
import AnimatedDice from './AnimatedDice.jsx';

export default function RollPopup({ open, avatar, onRoll, rolling, diceValues }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-gradient-to-br from-red-900 to-red-700 p-6 rounded-lg space-y-4 shadow-xl text-center w-64">
        <img src={avatar} alt="Player" className="w-12 h-12 rounded-full mx-auto border-2 border-brand-gold" />
        <h3 className="text-lg font-bold text-brand-gold drop-shadow">Your Turn</h3>
        <div className="flex justify-center space-x-2">
          <AnimatedDice value={diceValues[0]} rolling={rolling} />
          <AnimatedDice value={diceValues[1]} rolling={rolling} />
        </div>
        <button
          onClick={onRoll}
          disabled={rolling}
          className="w-full px-4 py-2 border border-brand-gold rounded text-brand-gold hover:bg-brand-gold hover:text-black disabled:opacity-50"
        >
          Roll
        </button>
      </div>
    </div>
  );
}
