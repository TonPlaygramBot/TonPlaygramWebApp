import type {Car} from '../shared/engine.mjs';
export function vehicleDamageAppearance(car:Pick<Car,'health'|'destroyed'|'burning'|'exploded'>):{brightness:number;roughness:number;charred:boolean};
