import type {Car} from '../shared/engine.mjs';
export type CivicCar=Car&{offset:number;civicConvoy:boolean;cruise:number};
export type CivicNpc={id:string;name:string;kind:string;health:number;weapon:null;x:number;z:number;heading:number;speed:number;motion:string;anim:string;seated:boolean};
export class CivicConvoySimulation {
 constructor(sim:any,options?:any);
 vehicles:CivicCar[];leg:number;speed:number;distance:number;wait:number;status:string;blocked:boolean;
 readonly principal:CivicCar|undefined;
 readonly destination:{id:string;label:string;x:number;z:number;wait:number};
 readonly npc:CivicNpc|null;
 readonly riders:any[];
 step(dt:number):void;
}
