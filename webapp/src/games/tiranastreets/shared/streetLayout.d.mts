import type { Point, Player, WORLD } from './engine.mjs';
export const SIDEWALK_WIDTH: number,
  SIDEWALK_HEIGHT: number,
  CITIZEN_COUNT: number;
export const SHOP: Point & { name: string };
export const SHOP_SOLIDS: number[][];
export type Signal = Point & {
  id: string;
  junction: number;
  yaw: number;
  width: number;
  name: string;
  axis: number;
};
export const SIGNALS: Signal[];
export function segmentDistance(
  x: number,
  z: number,
  a: number[],
  b: number[]
): number;
export function insideShop(p: Point, shop?: Point): boolean;
export function canReachCounter(
  p: Point & { carId?: string | null },
  shop?: Point
): boolean;
export function collideShop(p: Point, radius: number): boolean;
export function roadsNear(x: number, z: number): typeof WORLD.roads;
export function onCarriageway(x: number, z: number, margin?: number): boolean;
export function pavementHeight(x: number, z: number): number;
export function signalPhase(
  s: Signal,
  seconds: number
): 'red' | 'amber' | 'green';
export function pedestrianGreen(s: Signal, seconds: number): boolean;
export function stopForSignal(
  v: Point & { heading: number },
  seconds: number
): boolean;
export function shopRayDistance(a: Point, b: Point): number;

export function signalsNear(x: number, z: number): Signal[];
