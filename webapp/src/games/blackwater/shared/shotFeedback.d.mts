import type {Obstacle,Vec2} from '../core';
type Point=Vec2&{y:number};
export function obstacleHitNormal(point:Point,direction:Point,obstacle:Obstacle):Point|null;
export function traceBattleSurface(origin:Point,direction:Point,range:number,obstacles:readonly Obstacle[]):{distance:number;point:Point;kind:string;normal:Point|null};
