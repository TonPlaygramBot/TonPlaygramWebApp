export const segments = [300, 800, 1000, 1200, 1400, 1500, 1600, 1800];
const ONE_HOUR = 3600_000;

export function canSpin(lastSpin: number | null): boolean {
  if (!lastSpin) return true;
  return Date.now() - lastSpin >= ONE_HOUR;
}

export function nextSpinTime(lastSpin: number | null): number {
  return lastSpin ? lastSpin + ONE_HOUR : Date.now();
}

export function getRandomReward(): number {
  const index = Math.floor(Math.random() * segments.length);
  return segments[index];
}
