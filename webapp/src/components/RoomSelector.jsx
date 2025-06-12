import React from 'react';

const amounts = [100, 500, 1000, 5000, 10000];
const tokens = ['TPC', 'TON', 'USDT'];

export default function RoomSelector({ selected, onSelect }) {
  const { token, amount } = selected;
  return (
    <div className="space-y-2">
      {tokens.map((tok) => (
        <div key={tok} className="space-x-2">
          {amounts.map((amt) => (
            <button
              key={`${tok}-${amt}`}
              onClick={() => onSelect({ token: tok, amount: amt })}
              className={`px-2 py-1 border rounded ${
                token === tok && amount === amt
                  ? 'bg-yellow-400 text-gray-900'
                  : 'bg-gray-700 text-white'
              }`}
            >
              {amt} {tok}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
