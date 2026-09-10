import {writeFile} from 'node:fs/promises';
import {WORLD} from '../src/games/tiranastreets/shared/world.mjs';
import {CITY_SOURCE} from '../src/games/tirana-city-source/sourceData.mjs';
import {INSTITUTION_BUILDING_IDS,MAPPED_TREES} from '../src/games/tirana-city-source/registry.mjs';
import {STREET_SOURCE} from '../src/games/tirana-street-life/streetSourceData.mjs';
import {resolveStreetFronts,resolveStops,isMainStreet} from '../src/games/tirana-street-life/streetLifeCore.mjs';
import {facadeEdges,segmentDistance} from '../src/games/tirana-city-source/sourceCore.mjs';
import {containsPoint} from '../src/games/tirana-landmarks/nativeLocations.mjs';
const r=n=>Math.round(n*1000)/1000;
const fuelRoofs=STREET_SOURCE.fuel.filter(f=>f.tags.building==='roof');
const excluded=new Set([...INSTITUTION_BUILDING_IDS,...fuelRoofs.map(f=>f.id.slice(4)),...CITY_SOURCE.buildings.filter(b=>b.tags.amenity==='place_of_worship').map(b=>b.id.slice(4))]);
const {fronts,issues}=resolveStreetFronts(WORLD,STREET_SOURCE,excluded);
const blocked=(x,z,pad=0)=>WORLD.buildings.some(b=>containsPoint(x,z,b.p))||WORLD.roads.some(r=>!r.walk&&segmentDistance(x,z,r.a,r.b)<r.w/2+pad);
const storefronts=fronts.map(f=>{
 const terrace=f.outdoor&&[1.25,2.4,3.2].every(d=>!blocked(f.x+f.nx*d,f.z+f.nz*d,.6));
 return {id:f.id,buildingId:f.buildingId,name:f.name,kind:f.kind,shop:f.shop,x:r(f.x),z:r(f.z),yaw:r(f.yaw),width:r(f.width),street:f.street,terrace,point:f.point,placementAccuracy:f.placementAccuracy};
});
const stops=resolveStops(WORLD,STREET_SOURCE).map(s=>{
 // A known shelter is represented only where the whole rear bay fits. A pole
 // survives tight pavement without fabricating a shelter across a building.
 const c=Math.cos(s.yaw),v=Math.sin(s.yaw);
 const fits=[-1.8,1.8].every(x=>[-.35,-1.45].every(z=>!blocked(s.x+x*c+z*v,s.z-x*v+z*c,.15)));
 return {id:s.id,x:r(s.x),z:r(s.z),yaw:r(s.yaw),name:s.name,shelter:s.shelter&&fits,sourceShelter:s.shelter,bench:s.bench&&fits,point:s.point,placementAccuracy:s.placementAccuracy};
});
const fuel=STREET_SOURCE.fuel.map(f=>{
 const e=f.ring?facadeEdges(f.ring).sort((a,b)=>b.length-a.length)[0]:null;
 const canopy=f.tags.building==='roof';
 return {id:f.id,name:f.tags.name||f.tags.brand,x:r(!canopy&&e?e.x+e.nx*.3:f.p[0]),z:r(!canopy&&e?e.z+e.nz*.3:f.p[1]),point:f.p,ring:f.ring||null,canopy,yaw:r(e?.yaw||0),width:r(e?.length||2),depth:r(e?Math.max(...f.ring.map(p=>Math.abs((p[0]-e.a[0])*e.nx+(p[1]-e.a[1])*e.nz))):0),street:f.tags['addr:street']||'',placementAccuracy:canopy?'mapped roof; canopy height and pump arrangement estimated':'mapped station; branded identification only'};
});
const boulevard=WORLD.roads.filter(r=>/Dëshmorët e Kombit/.test(r.name)&&!r.walk);
const trees=MAPPED_TREES.flatMap(t=>{
 const nearBoulevard=t.z>100&&t.z<1070&&boulevard.some(r=>segmentDistance(t.x,t.z,r.a,r.b)<30);
 const square=t.x>-240&&t.x<365&&t.z>-335&&t.z<165;
 if((!nearBoulevard&&!square)||WORLD.roads.some(r=>!r.walk&&segmentDistance(t.x,t.z,r.a,r.b)<r.w/2+.25))return [];
 const seed=Number(t.id.split('/')[1])%997;
 const evergreen=t.tags.leaf_type==='needleleaved'||/Pinus|pine/i.test(t.tags.genus||t.tags.species||'');
 const shape=t.model==='tree_cypress'?'column':evergreen?'umbrella':nearBoulevard?(t.tags.leaf_type==='broadleaved'||seed%3===0?'upright':'umbrella'):'garden';
 const h=t.height||(shape==='upright'?20+seed%7:shape==='umbrella'?13+seed%5:shape==='column'?16+seed%5:5+seed%8);
 const crown=t.crown||(shape==='upright'?6.4+(seed%5)*.5:shape==='umbrella'?10+(seed%5)*.6:shape==='column'?3.2:5+(seed%5)*.65);
 return [{id:t.id,x:t.x,z:t.z,shape,height:r(h),crown:r(crown),seed,zone:nearBoulevard?'boulevard':'square-gardens',dimensionsAccuracy:t.height?'OSM height; crown may be estimated':'photo-informed size estimate',speciesAccuracy:t.speciesAccuracy}];
});
// Existing generic billboards are replaced by original city-poster fixtures.
// These safe roadside placements are AUTHORED, not surveyed advertising sites.
const advertising=[];
for(const road of WORLD.roads.filter(isMainStreet)){
 const dx=road.b[0]-road.a[0],dz=road.b[1]-road.a[1],len=Math.hypot(dx,dz);if(road.walk||road.bridge||len<55)continue;
 for(const side of [-1,1]){
  const nx=dz/len*side,nz=-dx/len*side,x=(road.a[0]+road.b[0])/2+nx*(road.w/2+3.4),z=(road.a[1]+road.b[1])/2+nz*(road.w/2+3.4);
  if(blocked(x,z,1.5)||advertising.some(p=>Math.hypot(x-p.x,z-p.z)<100)||stops.some(p=>Math.hypot(x-p.x,z-p.z)<9)||fronts.some(p=>Math.hypot(x-p.x,z-p.z)<8)||trees.some(p=>Math.hypot(x-p.x,z-p.z)<3))continue;
  advertising.push({id:`authored-ad-${advertising.length}`,x:r(x),z:r(z),yaw:r(Math.atan2(-nx,-nz)),name:'TIRANË',street:road.name||'',placementAccuracy:'authored roadside fixture; original city poster'});break;
 }
 if(advertising.length>=24)break;
}
const data={acquired:STREET_SOURCE.acquired,attribution:STREET_SOURCE.attribution,license:STREET_SOURCE.license,sourceFiles:STREET_SOURCE.sources,storefronts,stops,fuel,trees,advertising};
const target=new URL('../src/games/tirana-street-life/streetLifeData.mjs',import.meta.url);
await writeFile(target,'// Generated by compile-tirana-street-life.mjs. OSM ODbL-1.0; authored estimates explicitly tagged.\nexport const STREET_LIFE = '+JSON.stringify(data)+';\n');
await writeFile(new URL('../src/games/tirana-street-life/fuelCanopyData.mjs',import.meta.url),'// OSM roof outlines; keep simulation imports small.\nexport const FUEL_CANOPIES = '+JSON.stringify(fuel.filter(f=>f.canopy))+';\n');
await writeFile(new URL('../src/games/tirana-street-life/transitData.mjs',import.meta.url),'// OSM stops: shared furniture/collision identities.\nexport const BUS_STOPS = '+JSON.stringify(stops)+';\n');
await writeFile(new URL('../src/games/tirana-street-life/omittedFrontages.json',import.meta.url),JSON.stringify(issues,null,2)+'\n');
console.log({storefronts:storefronts.length,terraces:storefronts.filter(f=>f.terrace).length,stops:stops.length,shelters:stops.filter(s=>s.shelter).length,fuel:fuel.length,canopies:fuelRoofs.length,trees:trees.length,boulevardTrees:trees.filter(t=>t.zone==='boulevard').length,advertising:advertising.length,omitted:issues.length});
