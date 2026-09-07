export interface ThrowEvent {
  id: number;
  time: number;
  x: number;
  z: number;
  seed: number;
}
export interface WaterState {
  lastEvent: number;
  nextAt: number;
  started: number;
  target: { x: number; y: number; z: number; seed: number } | null;
}
export const WATER_DURATION: number, WATER_COOLDOWN: number;
export function createWaterState(): WaterState;
export function updateWater(
  state: WaterState,
  events: ThrowEvent[],
  truck: { x: number; z: number },
  time: number,
  running: boolean
): WaterState;
export function waterPoint(
  origin: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  t: number,
  time?: number
): { x: number; y: number; z: number };
