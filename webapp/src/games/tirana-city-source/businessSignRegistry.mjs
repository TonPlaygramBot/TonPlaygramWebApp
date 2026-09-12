import {WORLD} from '../tiranastreets/shared/world.mjs';
import {landmarkBuildings} from './landmarkCatalog.mjs';
import {REFERENCE_BUILDINGS} from './profiles.mjs';
import {frontage} from './sourceCore.mjs';
import {BUSINESS_SITES} from './businessSites.mjs';
/** Each mapped tenant has one owner. Distinct tenants in a shared building keep
 * separate boards and frontage anchors; no generic chain names are assigned. */
export const BUSINESS_SIGNS=[...BUSINESS_SITES.sites];
for(const b of landmarkBuildings(WORLD)){
 const p=REFERENCE_BUILDINGS[b.id];if(!p||!['mall','hotel','bank'].includes(p.category||''))continue;
 if(BUSINESS_SIGNS.some(s=>s.buildingId===b.id))continue;
 const e=frontage({footprint:b.p,anchor:null},WORLD.roads);if(!e)continue;
 const width=Math.min(14,e.length*.75),height=Math.min(2,width/5);
 BUSINESS_SIGNS.push({id:'building-sign/'+b.id,buildingId:b.id,name:p.style==='toptani'?'Toptani':p.name,category:p.category,kind:'building-sign',x:e.x+e.nx*.5,z:e.z+e.nz*.5,yaw:e.yaw,width,signHeight:height,mountHeight:Math.max(1.4,Math.min((p.height??b.h)-1.4,7)),street:'',terrace:false,point:[e.x,e.z],placementAccuracy:'Mapped business identity; approximate fascia mount',source:p.source});
}
export const BUSINESS_SIGN_BUILDING_IDS=new Set(BUSINESS_SIGNS.map(s=>s.buildingId));
