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

export default function DiceToken({ value = 1 }) {
  const orientation = `rotateX(calc(var(--board-angle, 60deg) * -1 - 25deg)) rotateY(25deg)`;
  const sides = [2, 3];
  return (
    <div className="dice-container w-16 h-16 perspective-1000" style={{ position: 'absolute', transform: 'translateZ(10px)' }}>
      <div
        className="dice-cube relative w-full h-full transform-style-preserve-3d"
        style={{ transform: orientation }}
      >
        <Face value={sides[0]} className="dice-face--front absolute" />
        <Face value={7 - sides[0]} className="dice-face--back absolute" />
        <Face value={sides[1]} className="dice-face--right absolute" />
        <Face value={7 - sides[1]} className="dice-face--left absolute" />
        <Face value={value} className="dice-face--top absolute" />
        <Face value={7 - value} className="dice-face--bottom absolute" />
      </div>
    </div>
  );
}
