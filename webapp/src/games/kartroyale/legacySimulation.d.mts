export interface Input {
  steer: number;
  brake: boolean;
  reverse?: boolean;
  drift: boolean;
  boost: boolean;
  shield: boolean;
  fire: boolean;
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
  rollTime: number;
  rollAngle: number;
  rollDirection: number;
  rollCooldown: number;
  lift: number;
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
  health: number;
  kartId: string;
  bodyLength?: number;
  bodyWidth?: number;
  shield: number;
  shieldMax: number;
  shieldActive: boolean;
  ammunition: number;
  fireCooldown: number;
  missileHits: number;
  retired: boolean;
  wallContact: boolean;
  impactId: number;
  impact: number;
  impactNx: number;
  impactNz: number;
  impactCooldown: number;
  damageFront: number;
  damageRear: number;
  damageSide: number;
  hitFlash: number;
  input: Input;
  lastInput: number;
  disconnected: boolean;
}
export interface TrackConfig {
  id: string;
  name: string;
  district: string;
  streets: string[];
  width: number;
  sky: string;
  ground: string;
  accent: string;
}
export interface Track extends TrackConfig {
  points: { x: number; z: number; yaw: number; distance: number; width?: number }[];
  length: number;
  x: number;
  z: number;
  bend: number;
  center: { x: number; z: number };
  bounds: number[];
}
export const STEP: number,
  LAPS: number,
  COLORS: string[],
  TRACKS: TrackConfig[];
export const RACE_LIMIT: number;
export const KARTS: { id: string; name: string; detail: string; speed:number; handling:number; brake:number; shield:number; ammunition:number }[];
export const TRACK_ALIASES: Record<string, string>;
export function normalizeTrack(id: string): string;
export function normalizeKart(id: string): string;
export function equipKart(r: Racer, id: string): Racer;
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
  z: number,
  hint?: number
): {
  index: number;
  width: number;
  distance: number;
  lane: number;
  x: number;
  z: number;
  yaw: number;
};
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
export function damageRacer(r: Racer, amount: number): number;
