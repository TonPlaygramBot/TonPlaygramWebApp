import {polygonContains} from './architecture.mjs';
/** Rotor disc and tail must fit inside the real footprint, including courtyards. */
export function roofClearance(p,building) {
 if(!polygonContains(p.x,p.z,building.p,building.holes||[]))return 0;
 let distance=Infinity;
 for(const ring of [building.p,...(building.holes||[])])for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.z-a[1])*dz)/(dx*dx+dz*dz||1)));
  distance=Math.min(distance,Math.hypot(p.x-a[0]-t*dx,p.z-a[1]-t*dz));
 }return distance;
}
const siteCache=new WeakMap();
export function rooftopHelicopterSites(world,count=3) {
 const cached=siteCache.get(world);if(cached&&cached.length>=count)return cached.slice(0,count).map(s=>({...s}));
 const sites=[];
 for(const b of [...world.buildings].filter(b=>b.h>=35).sort((a,b)=>b.h-a.h||String(a.id).localeCompare(String(b.id)))){
  const xs=b.p.map(p=>p[0]),zs=b.p.map(p=>p[1]);let best=null,clearance=0;
  for(let x=Math.min(...xs)+6;x<=Math.max(...xs)-6;x+=2)for(let z=Math.min(...zs)+6;z<=Math.max(...zs)-6;z+=2){
   const d=roofClearance({x,z},b);if(d>clearance){clearance=d;best={x,z};}
  }
  if(!best||clearance<6)continue;
  const edge=b.p.reduce((a,v)=>v[1]>a[1]?v:a,b.p[0]);
  sites.push({buildingId:b.id,name:b.name||'Rooftop helipad',...best,roofY:b.h,stairX:edge[0],stairZ:edge[1]+2,clearance});
  if(sites.length===count)break;
 }siteCache.set(world,sites);return sites.map(s=>({...s}));
}
// Hotel facilities confirmed by their official sites; footprint/roof levels use
// the existing city model. Pool/deck positions are authored approximations.
export const ROOFTOP_POOLS=Object.freeze([
 {buildingId:'196893237',name:'Mondial rooftop pool',width:8,depth:4,source:'https://www.hotelmondial.al/'},
 {buildingId:'1315788053',name:'Arka rooftop infinity pool',width:14,depth:5,source:'https://arkahotel.al/'}
]);
