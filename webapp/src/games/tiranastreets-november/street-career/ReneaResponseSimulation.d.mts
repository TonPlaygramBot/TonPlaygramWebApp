import type {Aircraft} from '../shared/engine.mjs';
export const RENEA_RESPONSE:Readonly<{stars:number;arrivalSpeed:number;approachDistance:number;crew:number;cooldown:number}>;
export class ReneaResponseSimulation {
 constructor(sim:any);
 aircraft:Aircraft|null;phase:string;crew:any[];cooldown:number;
 step(dt:number):void;
}
