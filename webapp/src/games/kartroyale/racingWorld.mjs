import {WORLD as CITY_WORLD} from '../tiranastreets/shared/world.mjs';
import {RURAL_WORLD} from './ruralWorldData.mjs';

// Racing retains its Farkë/Surrel circuits and free-roam starts. The shared city
// remains cropped; only a small archived corridor supplement enters this game.
const waterIds=new Set(RURAL_WORLD.waterAreas.map(w=>w.id));
export const WORLD={
 ...CITY_WORLD,
 bounds:CITY_WORLD.bounds.map((n,i)=>(i<2?Math.min:Math.max)(n,...RURAL_WORLD.regions.map(r=>r.bounds[i]))),
 roads:[...CITY_WORLD.roads,...RURAL_WORLD.roads],
 buildings:[...CITY_WORLD.buildings,...RURAL_WORLD.buildings],
 waterAreas:[...CITY_WORLD.waterAreas.filter(w=>!waterIds.has(w.id)),...RURAL_WORLD.waterAreas]
};
