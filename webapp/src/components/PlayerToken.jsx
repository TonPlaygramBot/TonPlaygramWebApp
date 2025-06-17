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

export default function PlayerToken({ type = 'normal', color }) {
  const colorClass =
    type === 'ladder' ? 'token-green' : type === 'snake' ? 'token-red' : 'token-yellow';
  const style = color ? { '--side-color': color, '--border-color': color } : undefined;
  const orientation =
    'rotateX(calc(var(--board-angle, 60deg) * -1 - 25deg)) rotateY(25deg)';

  return (
    <div className={`token-dice ${colorClass}`} style={style}>
      <div className="dice-cube w-full h-full" style={{ transform: orientation }}>
        <Face value={2} className="dice-face--front absolute" />
        <Face value={5} className="dice-face--back absolute" />
        <Face value={3} className="dice-face--right absolute" />
        <Face value={4} className="dice-face--left absolute" />
        <Face value={1} className="dice-face--top absolute" />
        <Face value={6} className="dice-face--bottom absolute" />
      </div>
    </div>
  );
}
