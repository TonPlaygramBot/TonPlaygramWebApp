import React, { useEffect } from 'react';

// Dice face dot matrix
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

// Enhanced isometric tilt: Z → X → Y
const baseTilt = 'rotateY(-15deg) rotateX(-35deg) rotateZ(45deg)';

// Face orientation to bring correct number on top
const valueToRotation = {
  1: 'rotateX(180deg)',
  2: 'rotateZ(-90deg)',
  3: 'rotateX(0deg)',
  4: 'rotateZ(90deg)',
  5: 'rotateX(-90deg)',
  6: 'rotateX(90deg)',
};

// 🎲 Single dice face component
function Face({ value, className }) {
  const face = diceFaces[value];
  return (
    <div className={`dice-face ${className}`}>
      <div className="grid grid-cols-3 grid-rows-3 gap-1">
        {face.flat().map((dot, i) => (
          <div key={i} className="flex items-center justify-center">
            {dot ? (
              <div className="dot shadow-md shadow-yellow-300" />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// 🎲 Single cube component
function DiceCube({ value = 1, rolling = false, playSound = false }) {
  const transform = valueToRotation[value] || 'rotateX(0deg)';
  const orientation = `${transform} ${baseTilt}`;

  useEffect(() => {
    if (rolling && playSound) {
      const audio = new Audio('/sounds/dice-roll.mp3');
      audio.play().catch(() => {}); // Handle autoplay restrictions gracefully
    }
  }, [rolling, playSound]);

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

// 🎲 Pair of dice — default setup
export default function DicePair({ values = [1, 1], rolling = false, playSound = false }) {
  return (
    <div className="flex gap-4 justify-center items-center">
      <DiceCube value={values[0]} rolling={rolling} playSound={playSound} />
      <DiceCube value={values[1]} rolling={rolling} playSound={playSound} />
    </div>
  );
}
