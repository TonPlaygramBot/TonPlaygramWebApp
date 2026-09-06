export interface Input {
  steer: number;
  brake: boolean;
  drift: boolean;
  boost: boolean;
}
export interface Racer {
  id: string;
  name: string;
  slot: number;
  ai: boolean;
  color: string;
  x: number;
  z: number;
  yaw: number;
  velocityYaw: number;
  speed: number;
  steering: number;
  yawRate: number;
  acceleration: number;
  boost: number;
  driftCharge: number;
  turbo: number;
  drifting: boolean;
  lap: number;
  nextGate: number;
  gates: number;
  index: number;
  progress: number;
  finished: boolean;
  finishTime: number;
  collision: number;
  input: Input;
  lastInput: number;
  disconnected: boolean;
}
export interface TrackConfig {
  id: string;
  name: string;
  district: string;
  x: number;
  z: number;
  bend: number;
  width: number;
  sky: string;
  ground: string;
  accent: string;
}
export interface Track extends TrackConfig {
  points: { x: number; z: number; yaw: number; distance: number }[];
  length: number;
}
export const STEP: number,
  LAPS: number,
  COLORS: string[],
  TRACKS: TrackConfig[];
export const CUPS: {
  name: string;
  track: string;
  difficulty: string;
  target: number;
  reward: number;
}[];
export function wrapAngle(a: number): number;
export function makeTrack(id?: string): Track;
export function nearestPoint(
  t: Track,
  x: number,
  z: number
): { index: number; distance: number; lane: number };
export function createRacer(
  t: Track,
  id: string,
  name: string,
  slot?: number,
  ai?: boolean
): Racer;
export function aiInput(r: Racer, t: Track, time: number, d?: string): Input;
export function stepRacer(
  r: Racer,
  input: Input,
  t: Track,
  dt: number,
  time: number,
  d?: string
): void;
export function stepRace(
  r: Racer[],
  t: Track,
  dt: number,
  time: number,
  d?: string
): void;
export function standings(r: Racer[]): Racer[];
