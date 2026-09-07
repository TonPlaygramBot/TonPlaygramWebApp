export const RIVER_PATHS: { line: number[][]; width: number }[];
export const RIVER_SEGMENTS: { a: number[]; b: number[]; width: number }[];
export const RAILINGS: {
  a: number[];
  b: number[];
  x: number;
  z: number;
  yaw: number;
  length: number;
  river: boolean;
}[];
export const RIVER_TREES: { x: number; z: number }[];
export function offsetPath(line: number[][], offset: number): number[][];
export function riverOutline(line: number[][], halfWidth: number): number[][];
export function nearBridge(x: number, z: number, margin?: number): boolean;
export function freeLandscape(x: number, z: number): boolean;
export function onFootpath(x: number, z: number, margin?: number): boolean;
export function collideRailings(
  p: { x: number; z: number },
  radius: number
): boolean;
