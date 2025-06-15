import { useEffect, useRef } from 'react';
import Dice from 'react-dice-roll';

export default function AnimatedDice({ value = 1, rolling = false, size = 64 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (rolling && ref.current) {
      // rollDice accepts an optional value to roll to
      ref.current.rollDice(value);
    }
  }, [rolling, value]);

  return (
    <Dice ref={ref} triggers={[]} defaultValue={value} size={size} />
  );
}
