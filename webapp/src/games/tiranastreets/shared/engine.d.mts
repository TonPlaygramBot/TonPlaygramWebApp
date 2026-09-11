export type Point = { x: number; z: number };
export type Input = {
  x: number;
  y: number;
  yaw: number;
  fast: boolean;
  brake: boolean;
  fire: boolean;
  seq: number;
};
export type Career = {
  completed: string[];
  best: Record<string, number>;
  credits: number;
};
export type Member = { id: string; name: string };
export type Car = Point & {
  id: string;
  heading: number;
  speed: number;
  vx: number;
  vz: number;
  steering: number;
  model: string;
  racingAsset?: string;
  forceVehicle?: string;
  forceCharacter?: string;
  responding?: boolean;
  driver: string | null;
};
export type Player = Point &
  Member & {
    heading: number;
    speed: number;
    carId: string | null;
    aircraftId?: string | null;
    index: number;
    finished: boolean;
    failed: boolean;
    finishTime: number | null;
    heat: number;
    health: number;
    armor: number;
    cash: number;
    wanted: number;
    searching?: boolean;
    lastCrime: number;
    lastDamage: number;
    respawnAt: number;
    nextShot: number;
    reloadAt: number;
    weapon: string;
    inventory: Record<string, { ammo: number; reserve: number }>;
    kills: number;
    shopMessage: string;
    input: Input;
    inputAt: number;
    lastAction: number;
  };
export type Mission = {
  id: string;
  title: string;
  district: string;
  type: string;
  description: string;
  time: number;
  reward: number;
  stars?: number;
  enemies?: number;
  stops: (Point & { name: string })[];
};
export type NPC = Point & {
  id: string;
  kind: string;
  motion: string;
  heading: number;
  speed: number;
  health: number;
  weapon: string | null;
  anim?: string;
  unit?: string;
  forceCharacter?: string;
  squadId?: string;
  seat?: number;
  deployed?: boolean;
  coverId?: string;
  downUntil: number;
};
export type Effect = Point & {
  id: number;
  at: number;
  kind: string;
  toX: number;
  toZ: number;
  owner: string;
  weapon: string;
};
export type State = {
  helicopter?: Point & { id:string; y:number; roofY:number; stairX:number; stairZ:number; heading:number; speed:number; pilot:string|null; airborne:boolean; nextMissile:number };
  lifeVersion:number;
  difficulty: string;
  shop: Point & { name: string };
  npcs: NPC[];
  units: Car[];
  effects: Effect[];
  effectSeq: number;
  nextDispatch: number;
  objectiveRemaining?: number;
  elapsed: number;
  phase: string;
  missionId: string;
  mode: string;
  players: Record<string, Player>;
  cars: Car[];
  traffic: (Car & {
    node: number;
    next: number;
    seed: number;
    cruise: number;
  })[];
  rival:
    | (Car & {
        path: Point[];
        pathIndex: number;
        index: number;
        finished: boolean;
        delay: number;
        nextRoute?: number;
      })
    | null;
  winner: string | null;
  message: string;
  teamIndex: number;
};
export const WORLD: {
  origin: number[];
  bounds: number[];
  roads: {
    a: number[];
    b: number[];
    w: number;
    walk: boolean;
    name: string;
    bridge: boolean;
    neighbourhood?: boolean;
    tunnel?: boolean;
  }[];
  buildings: {
    id: string;
    p: number[][];
    h: number;
    name: string;
    special: string;
    neighbourhood?: boolean;
    holes?: number[][][];
    minHeight?: number;
  }[];
  parks: number[][][];
  water: (number[][] | { line: number[][]; width: number })[];
  areas: number[][][];
  landmarks: (Point & { id: string; name: string })[];
  graph: { nodes: number[][]; edges: number[][]; directions?: number[] };
  sourceNodeAliases?: Record<string,string>;
  attribution: string;
  source: string;
  sourceSha256: string;
};
export const STEP: number;
export const MAX_PLAYERS: number;
export const MISSIONS: Mission[];
export const SPAWN: Point;
export const FREE_ROAM: Mission;
export function clamp(v: number, a: number, b: number): number;
export function emptyInput(): Input;
export function freshCareer(): Career;
export function nearestNode(x: number, z: number): number;
export function roadPoint(x: number, z: number): Point;
export function route(a: number, b: number): Point[];
export function insidePolygon(x: number, z: number, poly: number[][]): boolean;
export function collide(entity: Point, radius: number): boolean;
export function cameraDistance(
  x: number,
  z: number,
  y: number,
  yaw: number,
  wanted: number,
  pitch: number,
): number;
export function sanitizeInput(raw?: Partial<Input>): Input;
export function createState(
  members: Member[],
  missionId?: string,
  mode?: string,
  sport?: boolean,
  difficulty?: string,
): State;
export function addPlayer(
  state: State,
  member: Member,
  slot?: number,
  sport?: boolean,
): void;
export function removePlayer(state: State, id: string): void;
export function control(state: State, id: string, raw: Partial<Input>): void;
export function interact(state: State, id: string, action: string): void;
export function movePlayer(state: State, p: Player, dt: number): void;
export function stepState(state: State, dt?: number): void;
export function advanceState(state: State, seconds: number): void;
export function awardCareer(career: Career, state: State, id: string): Career;
export function navigation(state: State, id: string): Point[];
export function publicState(state: State): State;

export function lineOfSight(a: Point, b: Point): boolean;

export function upgradeState(state:State):State;
