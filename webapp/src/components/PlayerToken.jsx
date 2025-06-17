import React, { useMemo } from 'react';

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

export default function PlayerToken({ photoUrl, type = 'normal', color, value = 1 }) {
  const colorClass =
    type === 'ladder' ? 'token-green' : type === 'snake' ? 'token-red' : 'token-yellow';
  const style = color ? { '--side-color': color, '--border-color': color } : undefined;

  const rand = () => {
    if (window.crypto && window.crypto.getRandomValues) {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      return (arr[0] % 6) + 1;
    }
    return Math.floor(Math.random() * 6) + 1;
  };

  const sides = useMemo(() => {
    const used = new Set([value]);
    let front = rand();
    while (used.has(front)) {
      front = rand();
    }
    used.add(front);
    let right = rand();
    while (used.has(right)) {
      right = rand();
    }
    return [front, right];
  }, [value]);

  return (
    <div className={`token-cube ${colorClass}`} style={style}>
      <div className="token-cube-inner">
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
