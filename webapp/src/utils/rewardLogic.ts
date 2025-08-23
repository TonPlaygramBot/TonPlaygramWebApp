// Prize amounts available on the wheel.
export type Segment =
  | number
  | 'BONUS_X3'
  | 'FREE_SPIN'
  | 'BOMB';

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
  'BOMB',
  'BOMB',
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
const COOLDOWN = 60 * 60_000; // 1 hour

export function canSpin(lastSpin: number | null): boolean {
  if (!lastSpin) return true;
  return Date.now() - lastSpin >= COOLDOWN;
}

export function nextSpinTime(lastSpin: number | null): number {
  return lastSpin ? lastSpin + COOLDOWN : Date.now();
}

function secureRandom(): number {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return arr[0] / 0xffffffff;
  }
  return Math.random();
}

export function getRandomReward(): Segment {
  const index = Math.floor(secureRandom() * segments.length);
  return segments[index];
}

// Lucky Number game reward with 30% chance to hit bonus or free spin
export function getLuckyReward(): Segment {
  const r = secureRandom();
  if (r < 0.15) return 'BONUS_X3';
  if (r < 0.3) return 'FREE_SPIN';
  const idx = Math.floor(secureRandom() * numericSegments.length);
  return numericSegments[idx] as number;
}
