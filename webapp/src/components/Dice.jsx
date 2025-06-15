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

// Base tilt so the cube appears 3D when static
const baseTilt = 'rotateX(-25deg) rotateY(25deg)';

const faceTransforms = {
  1: `rotateX(0deg) rotateY(0deg) ${baseTilt}`,
  2: `rotateX(-90deg) rotateY(0deg) ${baseTilt}`,
  3: `rotateY(90deg) ${baseTilt}`,
  4: `rotateY(-90deg) ${baseTilt}`,
  5: `rotateX(90deg) rotateY(0deg) ${baseTilt}`,
  6: `rotateY(180deg) ${baseTilt}`,
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

export default function Dice({ value = 1, rolling = false }) {
  const orientation = faceTransforms[value] || faceTransforms[1];

  return (
    <div className="dice-container">
      <div
        className={`dice-cube ${rolling ? 'animate-roll' : ''}`}
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
