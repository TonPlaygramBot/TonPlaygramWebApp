import {drivingWorldData} from './roamObstacles.mjs';
import {createDrivingWorld} from './freeRoamCore.mjs';
let environment;
export const FREE_ROAM_STARTS=[
  {track:'tirana-zogu-pare',name:'City centre'},
  {track:'tirana-sulejman-delvina',name:'Blloku'}
];
export function freeRoamWorld(){return environment ||= createDrivingWorld(drivingWorldData());}
