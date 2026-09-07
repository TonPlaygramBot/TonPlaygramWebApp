export type FoodKind = 'egg' | 'tomato';
export interface Point3 {
  x: number;
  y: number;
  z: number;
}
export interface Food extends Point3 {
  kind: FoodKind;
  seed: number;
  age: number;
  vx: number;
  vy: number;
  vz: number;
}
export const GRAVITY: number, FOOD_LIFETIME: number;
export function randomUnit(seed: number): number;
export function launchFood(
  origin: Point3,
  racer: {
    x: number;
    z: number;
    velocityYaw: number;
    yaw: number;
    speed: number;
  },
  kind: FoodKind,
  seed?: number
): Food;
export function stepFood(p: Food, dt: number): void;
export function foodHit(
  from: Point3,
  to: Point3,
  previousKart: { x: number; z: number },
  kart: { x: number; z: number }
): Point3 | null;
