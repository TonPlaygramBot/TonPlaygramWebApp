import React, { useEffect } from 'react';

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

// Fixed isometric tilt showing 3 faces
const baseTilt = 'rotateX(-35deg) rotateY(45deg)';

// 🎲 Single dice face component
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

// 🎲 Single Dice Cube
function DiceCube({ value = 1, rolling = false, playSound = false }) {
  useEffect(() => {
    if (rolling && playSound) {
      const audio = new Audio('/sounds/dice-roll.mp3');
      audio.play().catch(() => {});
    }
  }, [rolling, playSound]);

  return (
    <div className="dice-container perspective-1000 w-24 h-24">
      <div
        className={`dice-cube relative w-full h-full transition-transform duration-500 transform-style-preserve-3d ${
          rolling ? 'animate-roll' : ''
        }`}
        style={!rolling ? { transform: baseTilt } : undefined}
      >
        {/* Static side faces */}
        <Face value={5} className="dice-face--front absolute" />
        <Face value={6} className="dice-face--back absolute" />
        <Face value={2} className="dice-face--right absolute" />
        <Face value={4} className="dice-face--left absolute" />

        {/* Top and bottom change dynamically */}
        <Face value={value} className="dice-face--top absolute" />
        <Face value={7 - value} className="dice-face--bottom absolute" />
      </div>
    </div>
  );
}

// 🎲 Dice Pair Component
export default function DicePair({ values = [1, 1], rolling = false, playSound = false }) {
  return (
    <div className="flex gap-4 justify-center items-center">
      <DiceCube value={values[0]} rolling={rolling} playSound={playSound} />
      <DiceCube value={values[1]} rolling={rolling} playSound={playSound} />
    </div>
  );
}
