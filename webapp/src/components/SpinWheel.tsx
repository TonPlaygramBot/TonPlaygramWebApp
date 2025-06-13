import { useState } from 'react';
import { segments, getRandomReward } from '../utils/rewardLogic';

interface SpinWheelProps {
  onFinish: (reward: number) => void;
  spinning: boolean;
  setSpinning: (b: boolean) => void;
  disabled?: boolean;
}

// Visual settings
const itemHeight = 56; // Each prize row is 56px tall
const visibleRows = 7; // Show 7 prize rows at all times
const winningRow = 2;  // 3rd row is the winner
const loops = 12;      // Spin depth for drama

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
      {/* Highlight the 3rd visible row as the winner */}
      <div
        className="absolute inset-x-0 border-4 border-yellow-500 pointer-events-none z-10"
        style={{ top: itemHeight * w*
