import {facadeEdges,segmentDistance} from '../tirana-city-source/sourceCore.mjs';
import {containsPoint} from '../tirana-landmarks/nativeLocations.mjs';
const polygonContains=(x,z,p,holes=[])=>containsPoint(x,z,p)&&!holes.some(h=>containsPoint(x,z,h));
const major=/Bulevard|Kavaj|Durrës|Myslym|Ibrahim|Sami Frash|Ismail Qemali|Abdyl|Vaso Pasha|Pjetër Bogdani|Hoxha Tahsin|Barrikad|Elbasan|Toptani|Reshit|Xhorxh|George|Bajram|Zhan|Urani Pano|Dëshmorët|Skënderbej/i;
export const isMainStreet=r=>major.test(r.name||'')||!r.walk&&r.w>=10;
const closest=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return [a[0]+dx*t,a[1]+dz*t];};
const numericLevel=t=>t.level!==undefined&&!String(t.level).split(';').some(s=>s.trim()==='0');
/** Business names are source-backed. Facades are category interpretations unless
 * a dated exterior overrides them. No cross-street or ambiguous tenant snapping. */
export function resolveStreetFronts(world,source,excluded=new Set()){
 const streets=world.roads.filter(isMainStreet),fronts=[],issues=[],occupied=[];
 for(const place of source.places){
  const t=place.tags;
  if(numericLevel(t)||/\b(sky club|aba 21|rooftop)\b/i.test(t.name||'')||t.location==='underground'||t.indoor==='yes'||t.disused==='yes'||t.access==='private'){issues.push({id:place.id,reason:'not verified at street level'});continue;}
  const containing=world.buildings.filter(b=>polygonContains(...place.p,b.p,b.holes));
  let building;
  if(place.id.startsWith('way/'))building=world.buildings.find(b=>b.id===place.id.slice(4));
  if(!building&&containing.length===1)building=containing[0];
  if(!building&&containing.length===0){
   const near=world.buildings.map(b=>({b,d:Math.min(...facadeEdges(b.p).map(e=>segmentDistance(...place.p,e.a,e.b)))})).filter(x=>x.d<=2.5).sort((a,b)=>a.d-b.d);
   if(near.length&&(!near[1]||near[1].d-near[0].d>1.5))building=near[0].b;
  }
  if(!building||excluded.has(building.id)){issues.push({id:place.id,reason:'no unambiguous eligible building'});continue;}
  const candidates=facadeEdges(building.p).filter(e=>e.length>=2.8).flatMap(e=>{
   const q=closest(place.p,e.a,e.b),distance=Math.hypot(q[0]-place.p[0],q[1]-place.p[1]);
   if(distance>10)return [];
   const roads=streets.map(r=>({r,d:segmentDistance(...q,r.a,r.b)})).filter(({r,d})=>d<=r.w/2+19&&segmentDistance(q[0]+e.nx,q[1]+e.nz,r.a,r.b)<d-.2);
   roads.sort((a,b)=>a.d-b.d);if(!roads.length)return [];
   return [{e,q,distance,road:roads[0].r,roadDistance:roads[0].d}];
  }).sort((a,b)=>a.distance-b.distance||a.roadDistance-b.roadDistance);
  if(!candidates.length){issues.push({id:place.id,reason:'no nearby main-street facade'});continue;}
  const {e,q,road,distance}=candidates[0];
  const along=(q[0]-e.a[0])*e.ux+(q[1]-e.a[1])*e.uz;
  const width=Math.min(4.8,e.length-.5),u=Math.max(width/2+.2,Math.min(e.length-width/2-.2,along));
  const x=e.a[0]+e.ux*u+e.nx*.12,z=e.a[1]+e.uz*u+e.nz*.12;
  if(occupied.some(o=>o.buildingId===building.id&&Math.abs(Math.sin(o.yaw-e.yaw))<.2&&Math.hypot(o.x-x,o.z-z)<(o.width+width)/2+.15)){issues.push({id:place.id,reason:'overlapping storefront assignment'});continue;}
  const row={id:place.id,sourceId:place.id,buildingId:building.id,name:t.name||t.brand,brand:t.brand||null,kind:place.category,shop:t.shop||null,x,z,yaw:e.yaw,nx:e.nx,nz:e.nz,width,street:road.name||t['addr:street']||'',point:place.p,tags:t,source:'https://www.openstreetmap.org/'+place.id,placementAccuracy:distance<.5?'mapped facade point':'mapped tenant; inferred frontage',outdoor:t.outdoor_seating==='yes'};
  fronts.push(row);occupied.push(row);
 }
 return {fronts,issues};
}
/** Keep the OSM stop centre. The marker is only offset from a mapped carriageway
 * when its source node is on the vehicle lane. Never invent a bus route/time. */
export function resolveStops(world,source){
 return source.stops.map(s=>{
  const roads=world.roads.filter(r=>!r.walk&&!r.bridge).map(r=>({r,d:segmentDistance(...s.p,r.a,r.b)})).sort((a,b)=>a.d-b.d);
  if(!roads.length||roads[0].d>35)return null;
  const {r,d}=roads[0],q=closest(s.p,r.a,r.b),dx=s.p[0]-q[0],dz=s.p[1]-q[1],len=Math.hypot(dx,dz);
  if(len<.1)return null; // Side cannot be recovered without guessing.
  const nx=dx/len,nz=dz/len,offset=Math.max(d,r.w/2+.65),x=q[0]+nx*offset,z=q[1]+nz*offset;
  if(world.buildings.some(b=>polygonContains(x,z,b.p,b.holes)))return null;
  return {id:s.id,x,z,point:s.p,yaw:Math.atan2(-nx,-nz),name:s.tags.name||'Stacion autobusi',shelter:s.tags.shelter==='yes',bench:s.tags.bench==='yes',source:'https://www.openstreetmap.org/'+s.id,placementAccuracy:offset>d?'mapped stop; pavement marker offset':'mapped stop point',tags:s.tags};
 }).filter(Boolean);
}
