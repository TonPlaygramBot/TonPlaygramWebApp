import { buildingAccessSites } from '../shared/buildingAccess.mjs';
import { ECONOMY_BANKS, ECONOMY_PROPERTIES } from './cityEconomyDefinitions.mjs';
export { ECONOMY_BANKS, ECONOMY_PROPERTIES } from './cityEconomyDefinitions.mjs';
const definitions=new Map([...ECONOMY_BANKS,...ECONOMY_PROPERTIES].map(s=>[s.id,s]));
const cache=new WeakMap();
/** Stable shared entrances for map, simulation, interior and imported visuals. */
export function cityEconomySites(world) {
  const access=buildingAccessSites(world);
  if(!cache.has(access))cache.set(access,access.filter(s=>definitions.has(s.economyId)).map(site=>({
    ...site,...definitions.get(site.economyId),accessId:site.id,x:site.entrance.x,z:site.entrance.z,
    counter:{x:site.center.x,y:site.interiorY,z:site.center.z}
  })));
  return cache.get(access);
}
