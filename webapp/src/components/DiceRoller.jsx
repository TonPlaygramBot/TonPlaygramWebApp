import React, { useState } from 'react';
import Dice from './Dice.jsx';

export default function DiceRoller({ onRollEnd }) {
  const [value, setValue] = useState(1);
  const [rolling, setRolling] = useState(false);

  const rollDice = () => {
    if (rolling) return;
    setRolling(true);
    let count = 0;
    const id = setInterval(() => {
      const v = Math.floor(Math.random() * 6) + 1;
      setValue(v);
      count += 1;
      if (count >= 20) {
        clearInterval(id);
        setRolling(false);
        onRollEnd && onRollEnd(v);
      }
    }, 100);
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <Dice value={value} rolling={rolling} />
      <button
        onClick={rollDice}
        disabled={rolling}
        className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded disabled:opacity-50"
      >
        Roll Dice
      </button>
    </div>
  );
}
