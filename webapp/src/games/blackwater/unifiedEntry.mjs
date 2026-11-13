import {STREET_OPERATIONS} from '../tiranastreets/shared/streetOperations.mjs';
import {BATTLEFIELD_MAP_CATALOG} from './shared/mapCatalog.mjs';
/** Old Battlefield/map URLs select a city operation. Legacy career URLs retain
 * the saved city campaign. Online remains owned by the existing room protocol. */
export function unifiedEntry(search=''){
  const params=new URLSearchParams(search),activity=params.get('activity');
  const city=activity==='career'||activity==='street-career'||activity==='explore';
  const district=BATTLEFIELD_MAP_CATALOG.find(m=>m.id===params.get('map'));
  const direct=STREET_OPERATIONS.find(o=>o.map===params.get('map'));
  const operation=!city&&district?(direct||[...STREET_OPERATIONS].sort((a,b)=>Math.hypot(a.x-district.worldX,a.z-district.worldZ)-Math.hypot(b.x-district.worldX,b.z-district.worldZ))[0])?.id:undefined;
  return {operation,difficulty:params.get('difficulty')==='veteran'?'hard':'normal'};
}
