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

// Gentle tilt so three faces are visible
const baseTilt = 'rotateX(-25deg) rotateY(25deg)';

// Orientation for each numbered face relative to the viewer
const faceTransforms = {
  1: `rotateX(0deg) rotateY(0deg) ${baseTilt}`,
  2: `rotateX(-90deg) rotateY(0deg) ${baseTilt}`,
  3: `rotateY(90deg) ${baseTilt}`,
  4: `rotateY(-90deg) ${baseTilt}`,
  5: `rotateX(90deg) rotateY(0deg) ${baseTilt}`,
  6: `rotateY(180deg) ${baseTilt}`,
};

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

// 🎲 Single cube component
function DiceCube({ value = 1, rolling = false, playSound = false, prevValue }) {
  const displayVal = rolling ? prevValue ?? value : value;
  // Keep the cube orientation fixed so the dice appears in the same position
  // every roll. Only the dots change to reflect the rolled number.
  const orientation = baseTilt;
  const opposite = { 1: 6, 2: 5, 3: 4, 4: 3, 5: 2, 6: 1 };

  useEffect(() => {
    if (rolling && playSound) {
      const audio = new Audio('https://snakes-and-ladders-game.netlify.app/audio/dice.mp3');
      audio.play().catch(() => {}); // Handle autoplay restrictions gracefully
    }
  }, [rolling, playSound]);

  return (
    <div className="dice-container perspective-1000 w-24 h-24">
      <div
        className={`dice-cube relative w-full h-full transition-transform duration-500 transform-style-preserve-3d ${
          rolling ? 'animate-roll' : ''
        }`}
        style={{ transform: orientation }}
      >
        <Face value={displayVal} className="dice-face--front absolute" />
        <Face value={opposite[displayVal]} className="dice-face--back absolute" />
        <Face value={3} className="dice-face--right absolute" />
        <Face value={4} className="dice-face--left absolute" />
        <Face value={2} className="dice-face--top absolute" />
        <Face value={5} className="dice-face--bottom absolute" />
      </div>
    </div>
  );
}

// 🎲 Pair of dice — default setup
export default function DicePair({ values = [1, 1], rolling = false, playSound = false, startValues }) {
  return (
    <div className="flex gap-4 justify-center items-center">
      <DiceCube value={values[0]} rolling={rolling} playSound={playSound} prevValue={startValues?.[0]} />
      <DiceCube value={values[1]} rolling={rolling} playSound={playSound} prevValue={startValues?.[1]} />
    </div>
  );
}
