import React, { useState, useEffect, useRef } from 'react';
import Dice from './Dice.jsx';
import { diceSound } from '../assets/soundData.js';

export default function DiceRoller({
  onRollEnd,
  onRollStart,
  clickable = false,
  numDice = 2,
  trigger,
  showButton = true,
  muted = false,
  finalValues,
}) {
  const [values, setValues] = useState(Array(numDice).fill(1));
  const [rolling, setRolling] = useState(false);
  const soundRef = useRef(null);
  const startValuesRef = useRef(values);
  const triggerRef = useRef(trigger);

  useEffect(() => {
    const initial = Array(numDice).fill(1);
    setValues(initial);
    startValuesRef.current = initial;
  }, [numDice]);

  useEffect(() => {
    soundRef.current = new Audio(diceSound);
    soundRef.current.preload = 'auto';
    soundRef.current.muted = muted;
    return () => {
      soundRef.current?.pause();
    };
  }, [muted]);

  useEffect(() => {
    if (trigger !== undefined && trigger !== triggerRef.current) {
      triggerRef.current = trigger;
      setTimeout(() => rollDice(), 1000); // show dice briefly before rolling
    }
  }, [trigger]);

  const rollDice = () => {
    if (rolling) return;
    if (soundRef.current && !muted) {
      soundRef.current.currentTime = 0;
      soundRef.current.play().catch(() => {});
    }
    startValuesRef.current = values;
    setRolling(true);
    onRollStart && onRollStart();

    const rand = () => {
      if (window.crypto && window.crypto.getRandomValues) {
        const arr = new Uint32Array(1);
        window.crypto.getRandomValues(arr);
        return (arr[0] % 6) + 1;
      }
      return Math.floor(Math.random() * 6) + 1;
    };

    const tick = 50; // ms between face changes
    const iterations = 20; // ~1 second of rolling
    let count = 0;

    const id = setInterval(() => {
      const results = Array.from({ length: numDice }, rand);
      setValues(results);
      count += 1;
      if (count >= iterations) {
        clearInterval(id);
        const final = finalValues
          ? Array.isArray(finalValues)
            ? finalValues
            : [finalValues]
          : results;
        setTimeout(() => {
          setValues(final);
          setRolling(false);
          startValuesRef.current = final;
          onRollEnd && onRollEnd(final);
        }, tick);
      }
    }, tick);
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div
        className={`flex space-x-4 ${clickable ? 'cursor-pointer' : ''}`}
        onClick={clickable ? rollDice : undefined}
      >
        <Dice values={values} rolling={rolling} startValues={startValuesRef.current} />
      </div>
      {!clickable && showButton && (
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
