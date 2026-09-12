import type { Point, Car } from '../shared/engine.mjs';
export type Vec3 = Point & { y: number };
export class StreetWorld {
  fractures:(Vec3&{objectId:string;radius:number})[];
  fracture(objectId:string,point:Vec3,radius:number):(Vec3&{objectId:string;radius:number})|null;
  constructor(
    solids?: {
      p: number[][];
      h: number;
      id?: string;
      minY?: number;
      minHeight?: number;
      holes?: number[][][];
    }[],
    legacyBounds?: boolean
  );
  surface(x: number, z: number, below?: number): number;
  clearance(p: Vec3, height: number, radius?: number): boolean;
  move(p: Vec3, dx: number, dz: number, height: number, step?: number): boolean;
  cast(
    a: Vec3,
    d: Vec3,
    max?: number,
    cars?: Car[],
    ignoreCar?: string
  ): { distance: number; point: Vec3; objectId: string; kind: string };
  clear(a: Vec3, b: Vec3, cars?: Car[], ignore?: string): boolean;
  vault(p: Vec3, yaw: number, height: number): Vec3 | null;
}
export function direction3(yaw: number, pitch: number): Vec3;
export function pointAlong(a: Vec3, d: Vec3, t: number): Vec3;
export function rayBox(
  a: Vec3,
  d: Vec3,
  b: { min: Vec3; max: Vec3 },
  max?: number
): number | null;
