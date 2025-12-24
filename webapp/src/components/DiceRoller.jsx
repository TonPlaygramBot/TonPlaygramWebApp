import React, { useState, useEffect, useRef } from 'react';
import { getGameVolume } from '../utils/sound.js';
import Dice from './Dice.jsx';
import { diceSound } from '../assets/soundData.js';
import { socket } from '../utils/socket.js';

export default function DiceRoller({
  onRollEnd,
  onRollStart,
  clickable = false,
  numDice = 2,
  trigger,
  showButton = true,
  muted = false,
  emitRollEvent = false,
  rollPayload,
  divRef,
  className = '',
  diceTransparent = false,
  renderVisual = true,
  placeholder = null,
  diceWrapperClassName = 'flex space-x-4 items-center justify-center',
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
    soundRef.current.volume = getGameVolume();
    return () => {
      soundRef.current?.pause();
    };
  }, [muted]);

  useEffect(() => {
    const handler = () => {
      if (soundRef.current) soundRef.current.volume = getGameVolume();
    };
    window.addEventListener('gameVolumeChanged', handler);
    return () => window.removeEventListener('gameVolumeChanged', handler);
  }, []);

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
        // allow the final face to be visible before stopping
        setTimeout(() => {
          setRolling(false);
          startValuesRef.current = results;
          onRollEnd && onRollEnd(results);
          if (emitRollEvent) {
            socket.emit('rollDice', rollPayload || {});
          }
        }, tick);
      }
    }, tick);
  };

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      <div
        className={`${diceWrapperClassName} ${clickable ? 'cursor-pointer' : ''}`}
        onClick={clickable ? rollDice : undefined}
        ref={divRef}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : -1}
        onKeyDown={
          clickable
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  rollDice();
                }
              }
            : undefined
        }
      >
        {renderVisual ? (
          <Dice
            values={values}
            rolling={rolling}
            startValues={startValuesRef.current}
            transparent={diceTransparent}
          />
        ) : (
          placeholder || <span className="sr-only">Roll dice</span>
        )}
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
