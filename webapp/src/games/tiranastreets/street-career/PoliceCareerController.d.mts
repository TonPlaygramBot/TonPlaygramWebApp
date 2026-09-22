import type {StreetSimulation,StreetAction} from './StreetSimulation.mjs';
import type {PoliceProfile,PoliceMission,PoliceUnit,PoliceRun} from './policeCareerCore.mjs';
import type {Point} from '../shared/engine.mjs';
export type PoliceView={unit:PoliceUnit;mission:PoliceMission;run:PoliceRun;objective:ReturnType<StreetSimulation['objective']>;context:StreetAction|null;target:Point|null};
export class PoliceCareerController{
 constructor(sim:StreetSimulation,profile:PoliceProfile);
 run:PoliceRun;mission:PoliceMission;
 target():Point|null;
 eligible():boolean;
 action():StreetAction|null;
 interact():boolean;
 step(dt:number):boolean;
 objective():ReturnType<StreetSimulation['objective']>;
 snapshot():void;
 view():PoliceView;
}
