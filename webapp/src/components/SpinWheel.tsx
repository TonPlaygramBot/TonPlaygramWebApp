import { useState } from 'react';
import { segments } from '../utils/rewardLogic';

interface SpinWheelProps {
  onFinish: (reward: number) => void;
  spinning: boolean;
  setSpinning: (b: boolean) => void;
  disabled?: boolean;
}

// Visual settings for the wheel
const itemHeight = 50; // Height per prize row
const visibleRows = 7; // Always display 7 rows
const winningRow = 2;  // 3rd visible row is the winner
const loops = 8;       // How many times the list repeats while spinning

export default function SpinWheel({
  onFinish,
  spinning,
  setSpinning,
  disabled
}: SpinWheelProps) {
  const [offset, setOffset] = useState(0);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);

  const items = Array.from(
    { length: segments.length * loops + visibleRows },
    (_, i) => segments[i % segments.length]
  );

  const spin = () => {
    if (spinning || disabled) return;

    const index = Math.floor(Math.random() * segments.length);
    const reward = segments[index];

    const finalIndex = loops * segments.length + index;
    const finalOffset = -(finalIndex - winningRow) * itemHeight;

    setOffset(finalOffset);
    setSpinning(true);
    setWinnerIndex(null);

    setTimeout(() => {
      setSpinning(false);
      setWinnerIndex(finalIndex);
      onFinish(reward);
    }, 4000);
  };

  return (
    <div className="w-40 mx-auto flex flex-col items-center">
      <div
        className="relative overflow-hidden w-full"
        style={{ height: itemHeight * visibleRows }}
      >
        {/* Highlight the winning (3rd) row */}
        <div
          className="absolute inset-x-0 border-2 border-yellow-500 pointer-ev
