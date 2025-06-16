import React, { useState, useEffect, useRef } from 'react';
import Dice from './Dice.jsx';

export default function DiceRoller({ onRollEnd, clickable = false, numDice = 2 }) {
  const rand = () => {
    if (window.crypto && window.crypto.getRandomValues) {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      return (arr[0] % 6) + 1;
    }
    return Math.floor(Math.random() * 6) + 1;
  };

  const initial = Array.from({ length: numDice }, rand);
  const [values, setValues] = useState(initial); // result for next roll
  const [rollingVals, setRollingVals] = useState(initial); // temp roll visuals
  const [rolling, setRolling] = useState(false);
  const soundRef = useRef(null);
  const startValuesRef = useRef(initial); // stores values for this roll

  useEffect(() => {
    const init = Array.from({ length: numDice }, rand);
    setValues(init);
    setRollingVals(init);
    startValuesRef.current = init;
  }, [numDice]);

  useEffect(() => {
    soundRef.current = new Audio('https://snakes-and-ladders-game.netlify.app/audio/dice.mp3');
    soundRef.current.preload = 'auto';
    return () => {
      soundRef.current?.pause();
    };
  }, []);

  const rollDice = () => {
    if (rolling) return;

    if (soundRef.current) {
      soundRef.current.currentTime = 0;
      soundRef.current.play().catch(() => {});
    }

    // Use current values as fixed starting orientation for the animation
    startValuesRef.current = values.slice();
    setRolling(true);

    let count = 0;
    const id = setInterval(() => {
      // Random temp display values during spin
      setRollingVals(Array.from({ length: numDice }, rand));
      count += 1;
      if (count >= 20) {
        clearInterval(id);
        setRolling(false);
        // Restore the original value for consistent final position
        setRollingVals(startValuesRef.current);
        onRollEnd && onRollEnd(startValuesRef.current);
        // Prepare next values for next roll
        const next = Array.from({ length: numDice }, rand);
        setValues(next);
        startValuesRef.current = next.slice();
      }
    }, 100);
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div
        className={`flex space-x-4 ${clickable ? 'cursor-pointer' : ''}`}
        onClick={clickable ? rollDice : undefined}
      >
        {rollingVals.map((val, i) => (
          <Dice
            key={i}
            value={val}
            rolling={rolling}
            startValue={startValuesRef.current[i]}
          />
        ))}
      </div>
      {!clickable && (
        <button
          onClick={rollDice}
          disabled={rolling}
          className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded disabled:opacity-50"
        >
          Roll Dice
        </button>
      )}
    </div>
  );
}
