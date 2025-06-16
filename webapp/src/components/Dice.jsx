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

// Fixed isometric tilt so three faces are always visible
const baseTilt = 'rotateX(-35deg) rotateY(45deg)';

// Rotation needed to bring each numbered face to the top while keeping
// the overall isometric camera tilt the same.
const valueToRotation = {
  1: 'rotateX(180deg)',  // bottom -> top
  2: 'rotateZ(-90deg)',  // right -> top
  3: 'rotateX(0deg)',    // already top
  4: 'rotateZ(90deg)',   // left -> top
  5: 'rotateX(-90deg)',  // front -> top
  6: 'rotateX(90deg)',   // back -> top
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
  const transform = valueToRotation[value] || 'rotateX(0deg)';
  // Apply value rotation first, then the common isometric tilt
  const orientation = `${baseTilt} ${transform}`;

  return (
    <div className="dice-container perspective-1000 w-24 h-24">
      <div
        className={`dice-cube relative w-full h-full transition-transform duration-500 transform-style-preserve-3d ${
          rolling ? 'animate-roll' : ''
        }`}
        style={!rolling ? { transform: orientation } : undefined}
      >
        <Face value={5} className="dice-face--front absolute" />
        <Face value={6} className="dice-face--back absolute" />
        <Face value={2} className="dice-face--right absolute" />
        <Face value={4} className="dice-face--left absolute" />
        <Face value={3} className="dice-face--top absolute" />
        <Face value={1} className="dice-face--bottom absolute" />
      </div>
    </div>
  );
}
