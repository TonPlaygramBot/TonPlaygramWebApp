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
              className={`lobby-tile w-[2.89rem] !px-[0.289rem] !py-[0.1445rem] flex flex-col items-center space-y-1 cursor-pointer text-[0.578rem] ${
                token === id && amount === amt
                  ? 'lobby-selected'
                  : ''
              }`}
            >
              <img
                src={icon}
                alt={id}
                className={
                  id === 'TPC'
                    ? 'w-[0.8092rem] h-[0.8092rem]'
                    : 'w-[1.156rem] h-[1.156rem]'
                }
              />
              <span>{amt.toLocaleString('en-US')}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
