import type {StreetSimulation} from './StreetSimulation.mjs';
import type {Aircraft,Point} from '../shared/engine.mjs';
export class FlightSimulation {
 constructor(sim:StreetSimulation);
 aircraft:Aircraft[];
 readonly current:Aircraft|undefined;
 access(a:Aircraft):Point;
 board(id:string):boolean;
 canExit():boolean;
 exit():boolean;
 step(dt:number):void;
 assist(action:string):boolean;
 objective():{title:string;detail:string;training:boolean}|null;
}
