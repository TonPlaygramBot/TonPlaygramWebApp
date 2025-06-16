import React, { useState, useEffect, useRef } from 'react';
import Dice from './Dice.jsx';

export default function DiceRoller({ onRollEnd, clickable = false, numDice = 2 }) {
  const [values, setValues] = useState(Array(numDice).fill(1));
  const [rolling, setRolling] = useState(false);
  const soundRef = useRef(null);

  useEffect(() => {
    setValues(Array(numDice).fill(1));
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
    setRolling(true);
    const rand = () => {
      if (window.crypto && window.crypto.getRandomValues) {
        const arr = new Uint32Array(1);
        window.crypto.getRandomValues(arr);
        return (arr[0] % 6) + 1;
      }
      return Math.floor(Math.random() * 6) + 1;
    };

    let count = 0;
    const id = setInterval(() => {
      const results = Array.from({ length: numDice }, rand);
      setValues(results);
      count += 1;
      if (count >= 20) {
        clearInterval(id);
        setRolling(false);
        onRollEnd && onRollEnd(results);
      }
    }, 100);
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div
        className={`flex space-x-4 ${clickable ? 'cursor-pointer' : ''}`}
        onClick={clickable ? rollDice : undefined}
      >
        {values.map((v, i) => (
          <Dice key={i} value={v} rolling={rolling} />
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
