import type { Car, Point } from '../shared/engine.mjs';
export const VEHICLE_ANCHORS: {
  doors: (Point & { y: number })[];
  seat: Point & { y: number };
  eye: Point & { y: number };
  wheel: Point & { y: number };
  maxSpeed: number;
};
export function carPoint(
  car: Car,
  p: Point & { y: number }
): Point & { y: number };

export function vehicleAnchors(car: Car): typeof VEHICLE_ANCHORS;
