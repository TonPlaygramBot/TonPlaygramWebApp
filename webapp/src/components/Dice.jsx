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

const faceTransforms = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(-90deg) rotateY(0deg)',
  3: 'rotateY(90deg)',
  4: 'rotateY(-90deg)',
  5: 'rotateX(90deg) rotateY(0deg)',
  6: 'rotateY(180deg)',
};

function Face({ value, className }) {
  const face = diceFaces[value];
  return (
    <div className={`dice-face ${className}`}>
      <div className="grid grid-cols-3 grid-rows-3 gap-1 w-full h-full">
        {face.flat().map((dot, i) => (
          <div key={i} className="flex items-center justify-center">
            {dot ? <div className="w-2 h-2 bg-black rounded-full" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dice({ value = 1, rolling = false }) {
  const orientation = faceTransforms[value] || faceTransforms[1];

  return (
    <div className="relative w-24 h-24 perspective">
      <div
        className={`w-full h-full relative transition-transform duration-700 transform-style-preserve-3d ${
          rolling ? 'animate-roll' : ''
        }`}
        style={!rolling ? { transform: orientation } : undefined}
      >
        <Face value={1} className="dice-face--front" />
        <Face value={6} className="dice-face--back" />
        <Face value={3} className="dice-face--right" />
        <Face value={4} className="dice-face--left" />
        <Face value={2} className="dice-face--top" />
        <Face value={5} className="dice-face--bottom" />
      </div>
    </div>
  );
}
