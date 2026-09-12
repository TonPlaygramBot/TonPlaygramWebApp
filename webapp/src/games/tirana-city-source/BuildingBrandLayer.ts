import {WORLD} from '../tiranastreets/shared/world.mjs';
import {landmarkBuildings} from './landmarkCatalog.mjs';
import {REFERENCE_BUILDINGS} from './profiles.mjs';
import {frontage} from './sourceCore.mjs';
import {StreetLifeLayer} from '../tirana-street-life/StreetLifeLayer';
/** Mapped businesses receive their own identity; no random chain tenancy.
 * Mounting dimensions are authored and independent of the footprint/collision. */
export class BuildingBrandLayer extends StreetLifeLayer {
 constructor(){
  const storefronts=landmarkBuildings(WORLD).flatMap(b=>{
   const p=REFERENCE_BUILDINGS[b.id];if(!p||!['mall','hotel'].includes(p.category||''))return [];
   const e=frontage({footprint:b.p,anchor:null} as any,WORLD.roads);if(!e)return [];
   const width=Math.min(14,e.length*.75),height=Math.min(2,width/5);
   return [{id:'building-sign/'+b.id,buildingId:b.id,name:p.style==='toptani'?'Toptani':p.name,kind:'building-sign',x:e.x+e.nx*.5,z:e.z+e.nz*.5,yaw:e.yaw,width,signHeight:height,mountHeight:Math.min((p.height??b.h)-1.4,7),street:'',terrace:false,point:[e.x,e.z],placementAccuracy:'Mapped business identity; approximate fascia mount',source:p.source}];
  });
  super({storefronts,stops:[],fuel:[],advertising:[]} as any,{},true);
  this.group.name='Tirana:mall-and-hotel-identities';
 }
}
