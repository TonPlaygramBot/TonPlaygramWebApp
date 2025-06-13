import { useState } from 'react';
import { segments, getRandomReward } from '../utils/rewardLogic';

interface SpinWheelProps {
  onFinish: (reward: number) => void;
  spinning: boolean;
  setSpinning: (b: boolean) => void;
  disabled?: boolean;
}

// Visual settings
const itemHeight = 50; // Each row is 50px high
const visibleRows = 7; // Show 7 prize rows
const winningRow = 2;  // Highlight the 3rd row (index 2)
const loops = 8;       // Spin loops for visual effect

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
    { length: segments.lengt
