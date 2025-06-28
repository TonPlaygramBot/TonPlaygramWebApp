import React from 'react';

const AMOUNTS = {
  TPC: [100, 500, 1000, 5000, 10000],
  TON: [0.1, 0.5, 1, 5, 10],
  USDT: [0.1, 0.5, 1, 5, 10],
};
const tokens = [
  { id: 'TPC', icon: '/icons/TPCcoin.png' },
  { id: 'TON', icon: '/icons/TON.png' },
  { id: 'USDT', icon: '/icons/Usdt.png' },
];

export default function RoomSelector({ selected, onSelect }) {
  const { token, amount } = selected;
  return (
    <div className="space-y-2">
      {tokens.map(({ id, icon }) => (
        <div key={id} className="flex items-center space-x-2">
          {AMOUNTS[id].map((amt) => (
            <button
              key={`${id}-${amt}`}
              onClick={() => onSelect({ token: id, amount: amt })}
              className={`lobby-tile px-2 py-1 flex items-center space-x-1 cursor-pointer ${
                token === id && amount === amt
                  ? 'bg-accent text-black'
                  : ''
              }`}
            >
              <span>{amt}</span>
              <img src={icon} alt={id} className="w-8 h-8" />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
