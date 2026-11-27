// Visual art area, not a legal neighbourhood boundary. World origin is the
// existing [41.3275,19.8188]. Anchor roads use the project's OSM source ways.
export const KODRA_PRIFTIT_VIEW=Object.freeze({x:2850,z:-1080,radius:370,bounds:[2630,-1310,3225,-870]});
const ways=new Map([
 ['45029584','Rruga Disha'],['184324924','Rruga Disha'],['1484033050','Rruga Disha'],
 ['184324915','Rruga Seit Gega'],['184330307','Rruga Vilson Blloshmi']
]);
export const KODRA_ASPHALT=16;
export const KODRA_COMPACTED=17;

// No names-only match, no inferred resurfacing. One Disha way is tagged
// compacted in this snapshot even though the municipality reports road works.
export function kodraRoadFinish(road) {
 if(!road||road.bridge||road.tunnel)return 0;
 const name=ways.get(String(road.way));
 if(!name||name!==road.name)return 0;
 if(road.tags?.surface==='asphalt')return KODRA_ASPHALT;
 return road.tags?.surface==='compacted'?KODRA_COMPACTED:0;
}

/** Eligible low-rise, uncharacterized walls reuse the existing plaster atlas.
 * Explicit wall and roof source tags and nonresidential sheds are untouched. */
export function kodraPlasterWall(building) {
 const tags=building?.tags||{}, points=building?.p;
 if(!Array.isArray(points)||points.length<3||!Number.isFinite(building.h)||building.h<2.7||building.h>8||
  building.special||!['yes','house','detached','residential','semidetached_house','terrace','villa'].includes(tags.building)||
  tags['building:colour']||tags['building:material']||tags.amenity||tags.historic||tags.construction||tags.military)return false;
 let x=0,z=0;
 for(const p of points){x+=p[0];z+=p[1];}
 x/=points.length;z/=points.length;
 const [minX,minZ,maxX,maxZ]=KODRA_PRIFTIT_VIEW.bounds;
 return x>=minX&&x<=maxX&&z>=minZ&&z<=maxZ&&
  Math.hypot(x-KODRA_PRIFTIT_VIEW.x,z-KODRA_PRIFTIT_VIEW.z)<=KODRA_PRIFTIT_VIEW.radius;
}
