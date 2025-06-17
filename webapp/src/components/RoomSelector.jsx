import React from 'react';

const amounts = [100, 500, 1000, 5000, 10000];
const tokens = [
  { id: 'TPC', icon: '/icons/tpc.svg' },
  { id: 'TON', icon: '/icons/ton.svg' },
  { id: 'USDT', icon: '/icons/usdt.svg' },
  // Dice token cloned from the Snake & Ladder game
  { id: 'DICE', icon: '/icons/dice.svg' },
];

export default function RoomSelector({ selected, onSelect }) {
  const { token, amount } = selected;
  return (
    <div className="space-y-2">
      {tokens.map(({ id, icon }) => (
        <div key={id} className="flex items-center space-x-2">
          {amounts.map((amt) => (
            <button
              key={`${id}-${amt}`}
              onClick={() => onSelect({ token: id, amount: amt })}
              className={`px-2 py-1 border rounded flex items-center space-x-1 ${
                token === id && amount === amt
                  ? 'bg-yellow-400 text-gray-900'
                  : 'bg-gray-700 text-white'
              }`}
            >
              <span>{amt}</span>
              <img src={icon} alt={id} className="w-4 h-4" />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
