import React, { useEffect } from "react";

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
const baseTilt = "rotateX(-25deg) rotateY(25deg)";

// Orientation for each numbered face relative to the viewer

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
function DiceCube({
  value = 1,
  rolling = false,
  playSound = false,
  prevValue,
}) {
  // Keep a fixed isometric orientation and simply swap the top face.
  const orientation = baseTilt;

  useEffect(() => {
    if (rolling && playSound) {
      const audio = new Audio(
        "https://snakes-and-ladders-game.netlify.app/audio/dice.mp3",
      );
      audio.play().catch(() => {}); // Handle autoplay restrictions gracefully
    }
  }, [rolling, playSound]);

  return (
    <div className="dice-container perspective-1000 w-24 h-24">
      <div
        className={`dice-cube relative w-full h-full transition-transform duration-500 transform-style-preserve-3d ${
          rolling ? "animate-roll" : ""
        }`}
        style={{ transform: orientation }}
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

// 🎲 Pair of dice — default setup
export default function DicePair({
  values = [1, 1],
  rolling = false,
  playSound = false,
  startValues,
}) {
  return (
    <div className="flex gap-4 justify-center items-center">
      <DiceCube
        value={values[0]}
        rolling={rolling}
        playSound={playSound}
        prevValue={startValues?.[0]}
      />
      <DiceCube
        value={values[1]}
        rolling={rolling}
        playSound={playSound}
        prevValue={startValues?.[1]}
      />
    </div>
  );
}
