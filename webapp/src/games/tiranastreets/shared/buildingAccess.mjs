import { BUILDING_PROFILES } from './architecture.mjs';
import { WORLD } from './world.mjs';
import { roofClearance, rooftopHelicopterSites, ROOFTOP_POOLS } from './rooftops.mjs';
import { groundHeight, buildingGround } from '../../tirana-east/terrainCore.mjs';

// Public identities come from mapped footprints. Every interior, access route,
// equipment placement and aircraft assignment below is an authored game layout.
const PUBLIC_INTERIORS = ['175108137','256162012','361451879','236566859','356918582','460695437'];
export const SKY_TOWER_ID = '465295338';
export const CAFE_REVOLUTION_SECONDS = 3600;
const cache = new WeakMap();
const rect = (x,z,w,d) => [[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]];
function centreInside(b) {
  const xs=b.p.map(p=>p[0]), zs=b.p.map(p=>p[1]);
  let best=null, clearance=0;
  for(let x=Math.min(...xs)+1;x<Math.max(...xs);x+=1.5)
    for(let z=Math.min(...zs)+1;z<Math.max(...zs);z+=1.5){
      const d=roofClearance({x,z},b);if(d>clearance){best={x,z};clearance=d;}
    }
  return best && {...best,clearance};
}
function hull(points){
 const sorted=points.map(p=>[...p]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
 const half=(a)=>{const out=[];for(const p of a){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
 return [...half(sorted).slice(0,-1),...half([...sorted].reverse()).slice(0,-1)];
}
function entryFor(b,c,world){
 const edges=b.p.map((a,i)=>{const e=b.p[(i+1)%b.p.length],dx=e[0]-a[0],dz=e[1]-a[1],l=Math.hypot(dx,dz);return {a,e,l,x:(a[0]+e[0])/2,z:(a[1]+e[1])/2,ux:dx/l,uz:dz/l};}).filter(e=>e.l>4);
 const choices=[];
 for(const e of edges){
  let nx=-e.uz,nz=e.ux;
  if(roofClearance({x:e.x+nx,z:e.z+nz},b)>0){nx=-nx;nz=-nz;}
  const entry={x:e.x+nx*2.8,z:e.z+nz*2.8};
  if(world.buildings.some(o=>o!==b&&roofClearance(entry,o)>0))continue;
  choices.push({...entry,nx,nz,ux:e.ux,uz:e.uz,doorX:e.x,doorZ:e.z,d:Math.hypot(e.x-c.x,e.z-c.z)});
 }
 return choices.sort((a,b)=>a.d-b.d)[0];
}
export function buildingAccessSites(world=WORLD) {
 if(cache.has(world))return cache.get(world);
 const ids=new Set([SKY_TOWER_ID,...PUBLIC_INTERIORS,...ROOFTOP_POOLS.map(p=>p.buildingId),...rooftopHelicopterSites(world,2).map(s=>String(s.buildingId))]);
 const sites=[];
 for(const id of ids){
  const building=world.buildings.find(b=>String(b.id)===id);if(!building)continue;
  const center=centreInside(building);if(!center||center.clearance<3.2)continue;
  const entrance=entryFor(building,center,world);if(!entrance)continue;
  const ground=buildingGround(building),isCafe=id===SKY_TOWER_ID;
  const visualHeight=building.visualHeightSource?building.h:BUILDING_PROFILES[id]?.height??building.h;
  const roofY=ground+visualHeight-(isCafe?6:0);
  const half=Math.min(5.2,center.clearance*.66), room=rect(center.x,center.z,half*2,half*2);
  const doorPoints=[-1,1].map(s=>[entrance.x+entrance.ux*s*1.2,entrance.z+entrance.uz*s*1.2]);
  const lobby=hull([...room,...doorPoints]);
  const stairs=PUBLIC_INTERIORS.includes(id)&&half>=3.5&&building.h>=6;
  const site={id:'access:'+id,buildingId:id,name:building.name||'Tarracë publike',building,center,half,ground,roofY,
    entrance:{...entrance,y:groundHeight(entrance.x,entrance.z)+.08},lobby,room,
    kind:isCafe?'cafe':ROOFTOP_POOLS.some(p=>p.buildingId===id)?'pool':stairs?'institution':'roof',
    stairs,travel:stairs?'stairs':'elevator',interiorY:ground+.08,
    roof:{x:center.x+(isCafe?0:-half+.8),z:center.z+half-.8,y:roofY},
    lobbyPoint:{x:center.x+half-.9,z:center.z+half-.9,y:ground+.08},
    equipment:{x:center.x+half+.85,z:center.z,y:roofY+.25},
    // Fictional room, deliberately separate from the real venue's floor plan.
    restroom:isCafe?{x:center.x-3,z:center.z-3,y:roofY}:null,
    source:isCafe?'https://skyhotel.al/':ROOFTOP_POOLS.find(p=>p.buildingId===id)?.source||'OpenStreetMap identity; authored public interior'};
  sites.push(site);
 }
 cache.set(world,sites);return sites;
}
export function siteVolumes(site){
 const volumes=[{p:site.lobby,minY:site.ground+.02,h:Math.min(site.roofY-.2,site.ground+3.45)}];
 if(site.stairs)volumes.push({p:site.room,minY:site.ground+.02,h:site.roofY+.1});
 return volumes;
}
export function stairTreads(site){
 if(!site.stairs)return [];
 const total=site.roofY-site.interiorY,flights=Math.max(2,Math.ceil(total/1.6));
 const rise=total/flights,steps=9,run=3.8,depth=run/steps,result=[];
 for(let f=0;f<flights;f++){
  const sign=f%2===0?-1:1,x=site.center.x+(f%2===0?-.88:.88);
  for(let i=0;i<steps;i++){
   const y=site.interiorY+rise*(f+(i+1)/steps),z=site.center.z+sign*(-run/2+(i+.5)*depth);
   result.push({id:`${site.id}:stair:${f}:${i}`,x,z,y,w:1.65,d:depth+.025,h:.13,landing:false});
  }
  result.push({id:`${site.id}:landing:${f}`,x:site.center.x,z:site.center.z+sign*(run/2+.55),y:site.interiorY+rise*(f+1),w:3.42,d:1.15,h:.15,landing:true});
 }
 // Top exits have space to walk from either landing out onto the retained roof.
 result.push({id:`${site.id}:top`,x:site.center.x,z:site.center.z+site.half-.45,y:site.roofY,w:site.half*2,d:.95,h:.15,landing:true});
 const lastSign=(flights-1)%2===0?-1:1;
 result.push({id:`${site.id}:roof-bridge`,x:site.center.x+site.half/2,z:site.center.z+lastSign*(run/2+.55),y:site.roofY,w:site.half+.2,d:1.15,h:.15,landing:true});
 result.push({id:`${site.id}:roof-walkway`,x:site.center.x+site.half-.5,z:site.center.z,y:site.roofY,w:1.1,d:site.half*2,h:.15,landing:true});
 return result;
}
export function accessCollisionSolids(solids,sites=buildingAccessSites()){
 const byId=new Map(sites.map(s=>[s.buildingId,s]));
 const out=[];
 for(const b of solids){
  const site=byId.get(String(b.id));if(!site){out.push(b);continue;}
  const roof=site.roofY-site.ground,low=Math.min(3.45,roof-.2);
  // A shallow supported lobby; holes apply only to the local career physics.
  out.push({...b,h:.02});
  out.push({...b,minY:.02,h:low,holes:[...(b.holes||[]),site.lobby]});
  if(roof>low)out.push({...b,minY:low,h:roof,holes:[...(b.holes||[]),...(site.stairs?[site.room]:[])]});
  const add=(id,x,z,y,w,d,h)=>out.push({id,baseY:0,minY:y-h,h:y,p:rect(x,z,w,d)});
  add(site.id+':lobby-floor',site.center.x,site.center.z,site.interiorY,site.half*2,site.half*2,.08);
  for(const t of stairTreads(site))add(t.id,t.x,t.z,t.y,t.w,t.d,t.h);
  if(site.kind==='cafe'){
   const r=11.25,p=Array.from({length:40},(_,i)=>[site.center.x+Math.cos(i*Math.PI/20)*r,site.center.z+Math.sin(i*Math.PI/20)*r]);
   out.push({id:site.id+':cafe-floor',baseY:0,minY:site.roofY-.3,h:site.roofY,p});
   const railingOuter=p.map(v=>[site.center.x+(v[0]-site.center.x)*1.015,site.center.z+(v[1]-site.center.z)*1.015]);
   const railingInner=p.map(v=>[site.center.x+(v[0]-site.center.x)*.975,site.center.z+(v[1]-site.center.z)*.975]);
   out.push({id:site.id+':cafe-railing',baseY:0,minY:site.roofY,h:site.roofY+.8,p:railingOuter,holes:[railingInner]});
   // Perimeter waist rail leaves the view clear. A deliberate jump can clear it.
   for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;add(`${site.id}:rail:${i}`,x,z,site.roofY+.8,.48,.48,.8);}
   const wc=site.restroom;
   add(site.id+':wc-back',wc.x,wc.z-1.4,site.roofY+2.7,3.1,.15,2.7);
   add(site.id+':wc-left',wc.x-1.5,wc.z,site.roofY+2.7,.15,2.9,2.7);
   add(site.id+':wc-right',wc.x+1.5,wc.z,site.roofY+2.7,.15,2.9,2.7);
   add(site.id+':wc-front',wc.x-1,wc.z+1.4,site.roofY+2.7,1.1,.15,2.7);
  }
 }
 return out;
}
