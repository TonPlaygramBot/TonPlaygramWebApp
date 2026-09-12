import type {
  State,
  Player,
  SimulationSystems,
  Point
} from '../shared/engine.mjs';
export type StreetAction = {
  id: string;
  label: string;
  visible: boolean;
  enabled: boolean;
  disabledReason: string;
  targetId: string | null;
  priority: number;
  mode: 'tap' | 'hold' | 'toggle';
  kind?: string;
};
export type StreetIntent = {
  x: number;
  y: number;
  yaw: number;
  pitch: number;
  fast: boolean;
  brake: boolean;
  fire: boolean;
  seq: number;
};
export type BodyState = {
  y: number;
  vy: number;
  vx: number;
  vz: number;
  yaw: number;
  pitch: number;
  height: number;
  eye: number;
  grounded: boolean;
  groundAt: number;
  jumpUntil: number;
  landUntil: number;
  crouched: boolean;
  crouchWanted: boolean;
  stamina: number;
  gait: number;
  locomotion: string;
  combat: string;
  interaction: string;
  action: null | {
    kind: string;
    start: number;
    duration: number;
    hand?: number;
    active?: number;
    committed?: boolean;
    targetId?: string;
    side?: number;
    landing?: Point & { y: number };
  };
  combo: number;
  aim: boolean;
  guard: boolean;
  sprint: boolean;
  recoil: number;
  wall: number;
  notice: string;
  focus: string | null;
  tutorial: string[];
  lastHealth: number;
};
export type StreetEvent = {
  id: number;
  at: number;
  kind: string;
  stage?: number;
  vehicleId?: string;
  targetId?: string;
  weapon?: string;
};
export class StreetSimulation {
  constructor(state: State, world?: import('./spatialCore.mjs').StreetWorld);
  state: State;
  world: import('./spatialCore.mjs').StreetWorld;
  body: BodyState;
  intent: StreetIntent;
  paused: boolean;
  events: StreetEvent[];
  eventSeq: number;
  hooks: SimulationSystems;
  settings: { aimAssist: boolean };
  loot: {
    id: string;
    weapon: string;
    x: number;
    y: number;
    z: number;
    ammo: number;
  }[];
  claimed: Set<string>;
  job: {
    stage: number;
    parcel: boolean;
    vehicleId: string | null;
    defend: number;
    tutorial: string[];
  };
  readonly player: Player;
  setIntent(raw: StreetIntent): void;
  step(dt: number): void;
  pause(): void;
  resume(): void;
  eye(): Point & { y: number };
  resolve(): StreetAction[];
  execute(id: string, targetId?: string | null): boolean;
  objective(): { title: string; detail: string; training: boolean };
}
export const TUTORIAL: readonly (readonly string[])[];
