import React from 'react';

const AMOUNTS = {
  TPC: [100, 500, 1000, 5000, 10000],
  TON: [0.1, 0.5, 1, 5, 10],
  USDT: [0.1, 0.5, 1, 5, 10],
};
const tokens = [
  { id: 'TPC', icon: '/assets/icons/ezgif-54c96d8a9b9236.webp' },
  { id: 'TON', icon: '/assets/icons/TON.webp' },
  { id: 'USDT', icon: '/assets/icons/Usdt.webp' },
];

export default function RoomSelector({ selected, onSelect, tokens: allowed }) {
  const { token, amount } = selected;
  const list = Array.isArray(allowed)
    ? tokens.filter((t) => allowed.includes(t.id))
    : tokens;
  return (
    <div className="space-y-2">
      {list.map(({ id, icon }) => (
        <div key={id} className="flex items-center space-x-2">
          {AMOUNTS[id].map((amt) => (
            <button
              key={`${id}-${amt}`}
              onClick={() => onSelect({ token: id, amount: amt })}
              className={`lobby-tile w-[4.25rem] !px-[0.425rem] !py-[0.2125rem] flex flex-col items-center space-y-1 cursor-pointer text-[0.85rem] ${
                token === id && amount === amt
                  ? 'lobby-selected'
                  : ''
              }`}
            >
              <img
                src={icon}
                alt={id}
                className={id === 'TPC' ? 'w-[1.19rem] h-[1.19rem]' : 'w-[1.7rem] h-[1.7rem]'}
              />
              <span>{amt.toLocaleString('en-US')}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
