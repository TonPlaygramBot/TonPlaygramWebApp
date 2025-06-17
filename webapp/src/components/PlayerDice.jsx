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

function Face({ value, className }) {
  const face = diceFaces[value];
  return (
    <div className={`dice-face ${className}`}>
      <div className="grid grid-cols-3 grid-rows-3 gap-1">
        {face.flat().map((dot, i) => (
          <div key={i} className="flex items-center justify-center">
            {dot ? <div className="dot" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlayerDice({ value = 1 }) {
  return (
    <div className="player-token" style={{ width: '3rem', height: '3rem' }}>
      <div className="dice-container w-full h-full">
        <div
          className="dice-cube"
          style={{ width: '100%', height: '100%', transform: 'rotateX(0deg) rotateY(0deg)' }}
        >
          <Face value={2} className="dice-face--front absolute" />
          <Face value={5} className="dice-face--back absolute" />
          <Face value={3} className="dice-face--right absolute" />
          <Face value={4} className="dice-face--left absolute" />
          <Face value={value} className="dice-face--top absolute" />
          <Face value={7 - value} className="dice-face--bottom absolute" />
        </div>
      </div>
    </div>
  );
}
