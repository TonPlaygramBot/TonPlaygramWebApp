// Prize amounts available on the wheel. Added a 5000 TPC jackpot.
export type Segment =
  | { type: 'tpc'; value: number }
  | { type: 'spin'; value: number };

// Mix TPC prizes with free spin rewards
export const segments: Segment[] = [
  { type: 'tpc', value: 300 },
  { type: 'spin', value: 1 },
  { type: 'tpc', value: 800 },
  { type: 'spin', value: 2 },
  { type: 'tpc', value: 1000 },
  { type: 'spin', value: 3 },
  { type: 'tpc', value: 1200 },
  { type: 'spin', value: 4 },
  { type: 'tpc', value: 1400 },
  { type: 'tpc', value: 1500 },
  { type: 'tpc', value: 1600 },
  { type: 'spin', value: 5 },
  { type: 'tpc', value: 1800 },
  { type: 'tpc', value: 5000 },
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
