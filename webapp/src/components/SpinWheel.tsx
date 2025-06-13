import { useState } from 'react';
import { segments, getRandomReward } from '../utils/rewardLogic';

interface SpinWheelProps {
  onFinish: (reward: number) => void;
  spinning: boolean;
  setSpinning: (b: boolean) => void;
  disabled?: boolean;
}

const itemHeight = 50; // Each row is 50px high
const visibleRows = 7; // Display 7 rows
const winningRow = 2;  // Third row (index 2) is the winner
const loops = 8;       // Spin loops before stopping

export default function SpinWheel({
  onFinish,
  spinning,
  setSpinning,
  disabled
}: SpinWheelProps) {
  const [offset, setOffset] = useState(0);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);

  const spin = () => {
    if (spinning || disabled) return;

    const reward = getRandomReward();
    const index = segments.indexOf(reward);
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

  const items = Array.from(
    { length: segments.length * loops + visibleRows + segments.length },
    (_, i) => segments[i % segments.length]
  );

  return (
    <div className="relative w-40 mx-auto flex flex-col items-center">
      {/* Highlight the 3rd (winning) row */}
      <div
        className="absolute inset-x-0 border-4 border-yellow-500 pointer-events-none z-10"
        style={{ top: itemHeight * winningRow, height: itemHeight }}
      />

      {/* Scrollable prize list */}
      <div
        className="overflow-hidden w-full"
        style={{ height: itemHeight * visibleRows }}
      >
        <div
          className="flex flex-col items-center w-full"
          style={{
            transform: `translateY(${offset}px)`,
            transition: 'transform 4s cubic-bezier(0.33,1,0.
