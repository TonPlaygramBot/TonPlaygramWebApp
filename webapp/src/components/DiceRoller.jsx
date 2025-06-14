import React, { useState } from 'react';
import Dice from './Dice.jsx';

export default function DiceRoller({ onRollEnd }) {
  const [values, setValues] = useState([1, 1]);
  const [rolling, setRolling] = useState(false);

  const rollDice = () => {
    if (rolling) return;
    setRolling(true);
    let count = 0;
    const id = setInterval(() => {
      const v1 = Math.floor(Math.random() * 6) + 1;
      const v2 = Math.floor(Math.random() * 6) + 1;
      setValues([v1, v2]);
      count += 1;
      if (count >= 20) {
        clearInterval(id);
        setRolling(false);
        onRollEnd && onRollEnd([v1, v2]);
      }
    }, 100);
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="flex space-x-4">
        <Dice value={values[0]} rolling={rolling} />
        <Dice value={values[1]} rolling={rolling} />
      </div>
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
