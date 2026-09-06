export type Point = { x: number; z: number };
export type Input = {
  x: number;
  y: number;
  yaw: number;
  fast: boolean;
  brake: boolean;
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
  driver: string | null;
};
export type Player = Point &
  Member & {
    heading: number;
    speed: number;
    carId: string | null;
    index: number;
    finished: boolean;
    failed: boolean;
    finishTime: number | null;
    heat: number;
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
  stops: (Point & { name: string })[];
};
export type State = {
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
  }[];
  buildings: {
    id: string;
    p: number[][];
    h: number;
    name: string;
    special: string;
  }[];
  parks: number[][][];
  water: (number[][] | { line: number[][]; width: number })[];
  areas: number[][][];
  landmarks: (Point & { id: string; name: string })[];
  graph: { nodes: number[][]; edges: number[][] };
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
