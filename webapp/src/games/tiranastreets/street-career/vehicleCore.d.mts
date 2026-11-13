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

export function vehicleAnchors(car: Car): typeof VEHICLE_ANCHORS & {leftPedal:Point & {y:number};rightPedal:Point & {y:number}};
export const STEERING_WHEEL_AXIS:Readonly<{x:number;y:number;z:number}>;
export function steeringWheelAngle(car:{steering?:number}):number;
export function steeringWheelRadius(car:{model?:string}):number;
export function steeringWheelContacts(car:Car,sample?:(x:number,z:number)=>number):{left:Point & {y:number};right:Point & {y:number}};
