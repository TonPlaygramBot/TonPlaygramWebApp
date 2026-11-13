import type {StreetSimulation} from './StreetSimulation.mjs';
import type {Aircraft,Car,Point,Player,NPC} from '../shared/engine.mjs';
export class CombatSimulation {
 constructor(sim:StreetSimulation);
 missiles: ({id:number;age:number;direction:Point&{y:number}}&Point&{y:number})[];
 fires:Map<string,{car:Car;until:number}>;
 emit(kind:string,point:Point&{y:number},extra?:Record<string,unknown>):void;
 actorHit(target:Player|NPC,attacker?:Player|NPC):void;
 launch(aircraft:Aircraft,yaw:number,pitch:number):boolean;
 impact(hit:{point:Point&{y:number};kind:string;objectId?:string},amount?:number,explosive?:boolean):void;
 damageVehicle(car:Car,amount:number,owner?:Player|NPC,cause?:'collision'|'bullet'|'explosive'|'heat'):void;
 step(dt:number):void;
}
