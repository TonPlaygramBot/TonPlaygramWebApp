import {drivingWorldData} from './roamObstacles.mjs';
import {createDrivingWorld} from './freeRoamCore.mjs';
let environment;
export const FREE_ROAM_STARTS=[
  {track:'skanderbeg',name:'City centre'},
  {track:'blloku',name:'Blloku'},
  {track:'liqeni',name:'Liqeni · Grand Park'},
  {track:'farke',name:'Farkë'},
  {track:'surrel',name:'Surrel'}
];
export function freeRoamWorld(){return environment ||= createDrivingWorld(drivingWorldData());}
