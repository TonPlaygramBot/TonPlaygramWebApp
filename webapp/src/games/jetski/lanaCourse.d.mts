export const LANA_CHANNEL_WIDTH: number;
export const LANA_RISE: number;
export const LANA_SAMPLE_COUNT: number;
export const LANA_CHANNEL: { id: string; width: number; line: number[][] };
export function makeLanaPoints(): { x: number; z: number }[];
export function nearestLana(
  x: number,
  z: number
): { index: number; distance: number; x: number; z: number };
export function lanaChannelDistance(x: number, z: number): number;
