// Prize amounts available on the wheel. Added a 5000 TPC jackpot.
// Possible prizes on the wheel. "spins" grants free spins instead of TPC.
export interface RewardSegment {
  tpc?: number;
  spins?: number;
}

export const segments: RewardSegment[] = [
  { tpc: 300 },
  { tpc: 800 },
  { tpc: 1000 },
  { tpc: 1200 },
  { tpc: 1400 },
  { tpc: 1500 },
  { tpc: 1600 },
  { tpc: 1800 },
  { tpc: 5000 },
  { spins: 5 },
  { tpc: 8888 },
  { tpc: 888 },
  { tpc: 33333 },
  { tpc: 5555 }
];
const ONE_HOUR = 3600_000;

export function canSpin(lastSpin: number | null, freeSpins: number = 0): boolean {
  if (freeSpins > 0) return true;
  if (!lastSpin) return true;
  return Date.now() - lastSpin >= ONE_HOUR;
}

export function nextSpinTime(lastSpin: number | null): number {
  return lastSpin ? lastSpin + ONE_HOUR : Date.now();
}

export function getRandomReward(): RewardSegment {
  const index = Math.floor(Math.random() * segments.length);
  return segments[index];
}
