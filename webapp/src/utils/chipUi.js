export const DEFAULT_CHIP_VALUES = Object.freeze([1000, 500, 200, 100, 50, 20, 10, 5, 2, 1]);

const CHIP_COLOR_MAP = Object.freeze({
  1: '#f2b21a',
  2: '#f97316',
  5: '#d54a3a',
  10: '#2196f3',
  20: '#4caf50',
  50: '#3a3331',
  100: '#38bdf8',
  200: '#7b4abd',
  500: '#a3362e',
  1000: '#1fb3d6'
});

export function getChipVisual(value) {
  const base = CHIP_COLOR_MAP[value] ?? '#22d3ee';
  const text = value >= 50 ? '#f8fafc' : '#0f172a';
  return { base, text };
}
