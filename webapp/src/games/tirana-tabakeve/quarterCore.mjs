import {facadeEdges,segmentDistance} from '../tirana-city-source/sourceCore.mjs';
import {inside,hash} from '../tirana-city-completion/placementCore.mjs';
export const QUARTER_BOUNDS=Object.freeze([535,-155,1700,625]);
export const QUARTER_ROADS=/Petro Nini Luarasi|Ali Demi|Bajram Curri|Zhan d.Ark|Mihal Grameno|Bajram Allaraj|Shyqyri Ishmi|Dalip Zavalani/;
export const inQuarter=(x,z)=>x>=QUARTER_BOUNDS[0]&&x<=QUARTER_BOUNDS[2]&&z>=QUARTER_BOUNDS[1]&&z<=QUARTER_BOUNDS[3];
export const BRIDGE=Object.freeze({x:606.035,z:119.75,yaw:Math.atan2(11.54,-19.01),length:22.24,width:2.5,rise:4.1,source:'https://tirana.al/pika-interesi/ura-e-tabakeve-6924'});
export function bridgeDeckHeight(along){return .13+BRIDGE.rise*Math.pow(Math.max(0,1-Math.abs(along)/(BRIDGE.length/2)),.74);}
/** Same hump profile as the visible cobbled deck; undefined away from bridge. */
export function tabakeveBridgeHeight(x,z){const dx=x-BRIDGE.x,dz=z-BRIDGE.z,c=Math.cos(BRIDGE.yaw),s=Math.sin(BRIDGE.yaw),u=dx*c+dz*s,v=-dx*s+dz*c;return Math.abs(u)<=BRIDGE.length/2&&Math.abs(v)<=BRIDGE.width/2?bridgeDeckHeight(u):undefined;}
export function selectQuarterBuildings(world,excluded=new Set(),institutions=[]){
 const roads=world.roads.filter(r=>!r.walk&&QUARTER_ROADS.test(r.name||'')&&[r.a,r.b].some(p=>inQuarter(...p)));
 const identities=new Map(institutions.map(s=>[s.buildingId,s]));
 return world.buildings.filter(b=>!excluded.has(b.id)&&b.p?.length>=3&&b.h>=3&&!b.tags?.construction&&b.tags?.building!=='roof'&&b.p.some(p=>inQuarter(...p))).flatMap(b=>{
  const identity=identities.get(b.id),edges=facadeEdges(b.p).filter(e=>e.length>=5),fronts=edges.filter(e=>roads.some(r=>segmentDistance(e.x,e.z,r.a,r.b)<32));
  if(!fronts.length&&!identity)return [];
  const centre={x:b.p.reduce((s,p)=>s+p[0],0)/b.p.length,z:b.p.reduce((s,p)=>s+p[1],0)/b.p.length};
  return [{id:b.id,...centre,h:b.h,seed:hash(b.id),kind:identity?.category||b.tags?.building||'building',name:identity?.name||b.name||'',edges:(fronts.length?fronts:edges.sort((a,b)=>b.length-a.length).slice(0,2)).map(e=>({a:e.a,b:e.b,ux:e.ux,uz:e.uz,nx:e.nx,nz:e.nz,length:e.length,yaw:e.yaw}))}];
 });
}
/** Dense street trees and quieter banks are authored art direction. Placement
 * must pass all supplied road/building/water guards; no source trunk moves. */
export function generateQuarterTrees(roads,paths,existing,safe){
 const trees=[],occupied=existing.map(t=>[t.x,t.z]);
 const emit=(x,z,zone,side,source)=>{
  if(!inQuarter(x,z)||!safe(x,z)||occupied.some(p=>Math.hypot(x-p[0],z-p[1])<7.5))return;
  const seed=hash(`${source}:${Math.round(x)}:${Math.round(z)}`),street=zone==='quarter-roadside';
  trees.push({id:`tabakeve-tree/${trees.length}`,x:+x.toFixed(2),z:+z.toFixed(2),shape:street?'upright':'garden',height:street?13+seed%4:8+seed%3,crown:street?8.2+(seed%4)*.4:5.2+(seed%3)*.25,seed,zone,side,source,dimensionsAccuracy:'Authored mature street / smaller bank canopy; not a trunk survey'});occupied.push([x,z]);
 };
 for(const r of roads.filter(r=>!r.walk&&!r.bridge&&QUARTER_ROADS.test(r.name||''))){
  const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],length=Math.hypot(dx,dz);if(length<8||![r.a,r.b].some(p=>inQuarter(...p)))continue;
  const count=Math.max(1,Math.floor(length/13));
  for(let i=0;i<count;i++)for(const side of [-1,1]){const t=(i+.5)/count,offset=side*((r.w||6.2)/2+2.3);emit(r.a[0]+dx*t-dz/length*offset,r.a[1]+dz*t+dx/length*offset,'quarter-roadside',side,r.name);}
 }
 for(const path of paths.filter(p=>p.lana))for(let j=1;j<path.line.length;j++){
  const a=path.line[j-1],b=path.line[j],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<8||![a,b].some(p=>inQuarter(...p)))continue;
  const count=Math.max(1,Math.floor(length/15));for(let i=0;i<count;i++)for(const side of [-1,1]){
   const t=(i+.5)/count,offset=side*(path.width/2+7.8);emit(a[0]+dx*t-dz/length*offset,a[1]+dz*t+dx/length*offset,'quarter-riverbank',side,path.id);
  }
 }
 return trees;
}
export function wallPoint(e,u,offset=.08){return {x:e.a[0]+e.ux*u+e.nx*offset,z:e.a[1]+e.uz*u+e.nz*offset};}
export function roofAnchor(building){
 const xs=building.p.map(p=>p[0]),zs=building.p.map(p=>p[1]);
 for(let x=Math.min(...xs)+2;x<Math.max(...xs)-2;x+=2.5)for(let z=Math.min(...zs)+2;z<Math.max(...zs)-2;z+=2.5)if(inside(x,z,building.p,building.holes||[])&&facadeEdges(building.p).every(e=>segmentDistance(x,z,e.a,e.b)>1.5))return {x,z};
 return null;
}
/** Supplemental architectural details only: the mapped shell, its existing
 * windows, public identity and collision footprint keep their original owner. */
export function quarterFacadeParts(b){
 const parts=[],school=/school|kindergarten|college/.test(b.kind),palette=[0xd8c9ad,0xe4dbbd,0xcf846d,0xb7c6bb,0xc5b6a2],trim=school?0xe5dfcc:palette[b.seed%palette.length];
 const wall=(e,u,y,w,h,d,color,offset=.13)=>parts.push({...wallPoint(e,u,offset),y,w,h,d,color,yaw:Math.atan2(e.nx,e.nz),model:'box',buildingId:b.id});
 for(const [index,e] of b.edges.entries()){
  wall(e,e.length/2,b.h-.23,e.length,.27,.28,trim);
  wall(e,e.length/2,.45,e.length,.7,.1,0x99968b,.075);
  // Short corner bands avoid covering the source window rhythm.
  for(const u of [.13,e.length-.13])wall(e,u,b.h/2,.22,Math.max(.4,b.h-.45),.15,trim,.09);
  if(school){
   for(let y=3.2;y<b.h-.8;y+=3.2)wall(e,e.length/2,y,e.length,.24,.14,0xc5cda7);
   if(index===0&&e.length>8)wall(e,e.length/2,2.75,Math.min(5,e.length-1),.18,.85,0xcacac0,.4);
  }else if(b.h>6){
   const count=Math.min(24,Math.floor(e.length/4));
   for(let y=4.7,row=0;y<b.h-1;y+=3.2,row++)for(let col=0;col<count;col++){
    // Open roller shutters attach beside, rather than over, existing glazing.
    if((col+row+b.seed)%5!==0)continue;
    const u=(col+.5)*e.length/count;
    wall(e,u-1.05,y,.3,1.55,.1,(b.seed+col)%2?0x628075:0xd8ceaf,.15);
    wall(e,u+1.05,y,.3,1.55,.1,(b.seed+col)%2?0x628075:0xd8ceaf,.15);
    wall(e,u,y+.88,2.45,.11,.58,trim,.3);
   }
  }
 }
 if(b.roof){
  // Rooftop tanks sit wholly inside a retained footprint, never in courtyards.
  parts.push({x:b.roof.x,z:b.roof.z,y:b.h+.54,w:.82,h:1.02,d:.82,color:0x52594e,yaw:0,model:'tank',buildingId:b.id});
  parts.push({x:b.roof.x,z:b.roof.z,y:b.h+1.07,w:.87,h:.08,d:.87,color:0x757b6c,yaw:0,model:'tank',buildingId:b.id});
 }
 return parts;
}
