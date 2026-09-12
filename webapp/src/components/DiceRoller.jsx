import React, { useState, useEffect, useRef } from 'react';
import { createDiceRollAudio } from '../utils/diceAudio.js';
import Dice from './Dice.jsx';
import { socket } from '../utils/socket.js';

export default function DiceRoller({
  onRollEnd,
  onRollStart,
  durationMs = 1050,
  triggerDelayMs = 1000,
  disabled = false,
  clickable = false,
  numDice = 2,
  trigger,
  showButton = true,
  muted = false,
  emitRollEvent = false,
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
  const rollingRef = useRef(false);
  const timersRef = useRef(new Set());
  const callbacksRef = useRef({ onRollStart, onRollEnd });
  callbacksRef.current = { onRollStart, onRollEnd };
  const rollRef = useRef(null);
  const later = (fn, ms) => {
    const id = setTimeout(() => { timersRef.current.delete(id); fn(); }, ms);
    timersRef.current.add(id);
    return id;
  };
  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current.clear();
    rollingRef.current = false;
  }, []);

  useEffect(() => {
    const initial = Array(numDice).fill(1);
    setValues(initial);
    startValuesRef.current = initial;
  }, [numDice]);

  useEffect(() => {
    soundRef.current = createDiceRollAudio({ muted });
    return () => {
      soundRef.current?.pause();
    };
  }, [muted]);

  useEffect(() => {
    const handler = () => {
      if (soundRef.current) soundRef.current.volume = 1;
    };
    window.addEventListener('gameVolumeChanged', handler);
    return () => window.removeEventListener('gameVolumeChanged', handler);
  }, []);

  useEffect(() => {
    if (trigger !== undefined && trigger !== triggerRef.current) {
      triggerRef.current = trigger;
      const id = later(() => rollRef.current?.(), triggerDelayMs);
      return () => { clearTimeout(id); timersRef.current.delete(id); };
    }
  }, [trigger, triggerDelayMs]);

  const rollDice = () => {
    if (rollingRef.current || disabled) return;
    rollingRef.current = true;
    if (soundRef.current && !muted) {
      soundRef.current.currentTime = 0;
      soundRef.current.play().catch(() => {});
    }
    startValuesRef.current = values;
    setRolling(true);


    const rand = () => {
      if (window.crypto?.getRandomValues) {
        const arr = new Uint32Array(1);
        const maxUnbiased = Math.floor(0x100000000 / 6) * 6;
        let value = 0;
        do {
          window.crypto.getRandomValues(arr);
          value = arr[0];
        } while (value >= maxUnbiased);
        return (value % 6) + 1;
      }
      return Math.floor(Math.random() * 6) + 1;
    };

    // Choose once before the throw, so the visible cube lands on the same
    // result used by gameplay. No independently randomized landing face.
    const results = Array.from({ length: numDice }, rand);
    callbacksRef.current.onRollStart?.(results);
    later(() => {
      setValues(results);
      setRolling(false);
      rollingRef.current = false;
      startValuesRef.current = results;
      callbacksRef.current.onRollEnd?.(results);
      if (emitRollEvent) socket.emit('rollDice');
    }, durationMs);
  };
  rollRef.current = rollDice;

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      <div
        className={`${diceWrapperClassName} ${clickable ? 'cursor-pointer' : ''}`}
        onClick={clickable && !disabled ? rollDice : undefined}
        ref={divRef}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable && renderVisual && !disabled ? 0 : -1}
        aria-disabled={disabled || rolling}
        aria-label="Roll dice"
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
          disabled={rolling || disabled}
          className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded disabled:opacity-50"
        >
          Roll Dice
        </button>
      )}
    </div>
  );
}
