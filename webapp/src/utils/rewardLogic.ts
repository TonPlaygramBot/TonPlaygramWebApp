// Prize amounts available on the wheel.
export type Segment = number | 'BONUS_X3' | 'FREE_SPIN';

export const segments: Segment[] = [
  400,
  600,
  800,
  1000,
  1200,
  1400,
  1600,
  'FREE_SPIN',
  'BONUS_X3',
];

export const numericSegments: Segment[] = [
  400,
  600,
  800,
  1000,
  1200,
  1400,
  1600,
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
