import React from 'react';

const diceFaces = {
  1: [
    [0, 0, 0],
    [0, 1, 0],
    [0, 0, 0],
  ],
  2: [
    [1, 0, 0],
    [0, 0, 0],
    [0, 0, 1],
  ],
  3: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  4: [
    [1, 0, 1],
    [0, 0, 0],
    [1, 0, 1],
  ],
  5: [
    [1, 0, 1],
    [0, 1, 0],
    [1, 0, 1],
  ],
  6: [
    [1, 0, 1],
    [1, 0, 1],
    [1, 0, 1],
  ],
};

export default function Dice({ value = 1, rolling = false }) {
  const face = diceFaces[value] || diceFaces[1];
  return (
    <div
      className={`w-24 h-24 bg-white rounded-xl shadow-lg flex items-center justify-center transition-transform ${
        rolling ? 'animate-roll' : ''
      }`}
    >
      <div className="grid grid-cols-3 grid-rows-3 gap-1 w-20 h-20">
        {face.flat().map((dot, i) => (
          <div key={i} className="flex items-center justify-center">
            {dot ? <div className="w-3 h-3 bg-black rounded-full" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
