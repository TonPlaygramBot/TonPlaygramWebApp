import type {StreetSimulation} from './StreetSimulation.mjs';
export type DeployedEquipment={id:string;x:number;y:number;z:number;heading:number};
export class EquipmentSimulation {
 constructor(sim:StreetSimulation);
 charges:DeployedEquipment[];
 drones:(DeployedEquipment & {direction:{x:number;y:number;z:number};age:number})[];
 fire():boolean;
 detonate():boolean;
 step(dt:number):void;
}
