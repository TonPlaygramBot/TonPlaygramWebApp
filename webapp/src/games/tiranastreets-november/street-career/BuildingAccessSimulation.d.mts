import type {StreetSimulation,StreetAction} from './StreetSimulation.mjs';
import type {AccessPoint,AccessSite} from '../shared/buildingAccess.mjs';
export class BuildingAccessSimulation {
 constructor(sim:StreetSimulation,sites?:AccessSite[]);
 sites:AccessSite[];
 travel:null|{siteId:string;kind:string;from:AccessPoint;to:AccessPoint;elapsed:number;duration:number};
 binoculars:boolean;
 parachute:{packed:boolean;open:boolean};
 collected:Set<string>;
 candidates():StreetAction[];
 actions():StreetAction[];
 execute(action:StreetAction):boolean;
 reset():void;
 step(dt:number):boolean;
 objective():{title:string;detail:string;training:boolean}|null;
}
