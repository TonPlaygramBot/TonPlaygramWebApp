// Prize amounts available on the wheel. Added a 5000 TPC jackpot.
export type Segment = number | 'BONUS_X3';

export const segments: Segment[] = [
  300,
  800,
  1000,
  1200,
  1400,
  1500,
  1600,
  1800,
  5000,
  'BONUS_X3',
];
const COOLDOWN = 15 * 60_000; // 15 minutes

export function canSpin(lastSpin: number | null): boolean {
  if (!lastSpin) return true;
  return Date.now() - lastSpin >= COOLDOWN;
}

export function nextSpinTime(lastSpin: number | null): number {
  return lastSpin ? lastSpin + COOLDOWN : Date.now();
}

export function getRandomReward(): Segment {
  const index = Math.floor(Math.random() * segments.length);
  return segments[index];
}
