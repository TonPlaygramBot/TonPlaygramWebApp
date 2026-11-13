export interface Input {
  steer: number;
  throttle: boolean;
  brake: boolean;
  boost: boolean;
  recover: boolean;
}
export interface Point {
  x: number;
  z: number;
  heading: number;
  index: number;
}
export interface Track {
  id: string;
  name: string;
  subtitle: string;
  width: number;
  wave: number;
  length: string;
  difficulty: string;
  pointToPoint: boolean;
  laps: number;
  points: { x: number; z: number }[];
  lengths: number[];
  totalLength: number;
  gates: Point[];
  ramps: Point[];
  pickups: Point[];
}
export interface EjectedRider {
  x: number;
  z: number;
  height: number;
  vx: number;
  vz: number;
  verticalSpeed: number;
  heading: number;
  age: number;
}
export interface Racer {
  id: string;
  name: string;
  slot: number;
  ai: boolean;
  craftId: string;
  x: number;
  z: number;
  heading: number;
  vx: number;
  vz: number;
  speed: number;
  steer: number;
  boost: number;
  boosting: boolean;
  height: number;
  verticalSpeed: number;
  airborne: boolean;
  landings: number;
  jumpDistance: number;
  nextGate: number;
  gatesPassed: number;
  lap: number;
  lapStarted: number;
  bestLap: number;
  finishTime: number;
  finished: boolean;
  disconnected: boolean;
  penalty: number;
  progress: number;
  pickupAt: number[];
  rampAt: number;
  recoveryAt: number;
  hitAt: number;
  crashes: number;
  crash: EjectedRider | null;
  input: Input;
  lastInput: number;
}
export const STEP: number, RACE_LIMIT: number, LAPS: number;
export const TRACKS: Pick<
  Track,
  'id' | 'name' | 'subtitle' | 'width' | 'wave' | 'length' | 'difficulty'
>[];
export const CRAFTS: {
  id: string;
  name: string;
  role: string;
  speed: number;
  acceleration: number;
  handling: number;
  color: string;
}[];
export function clamp(n: number, a: number, b: number): number;
export function wrapAngle(a: number): number;
export function normalizeTrack(id: unknown): string;
export function normalizeCraft(id: unknown): string;
export function makeTrack(id: unknown): Track;
export function sample(track: Track, index: number, offset?: number): Point;
export function nearest(
  track: Track,
  x: number,
  z: number
): { index: number; distance: number; x: number; z: number };
export function waterHeight(
  x: number,
  z: number,
  time: number,
  wave?: number
): number;
export function neutralInput(): Input;
export function sanitizeInput(data?: Partial<Input>): Input;
export function createRacer(
  track: Track,
  id: string,
  name: string,
  slot: number,
  ai?: boolean,
  craftId?: string
): Racer;
export function aiInput(r: Racer, track: Track, difficulty?: string): Input;
export function stepRace(
  racers: Racer[],
  track: Track,
  dt: number,
  elapsed: number,
  difficulty?: string
): void;
export function standings(racers: Racer[]): Racer[];
export function formatTime(time: number): string;
